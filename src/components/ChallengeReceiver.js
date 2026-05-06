import React, { useState, useEffect, useMemo, useCallback } from "react";
import { fmtUSD, imgSrc } from "../utils";
import { supabase } from "../supabase";

// Watch Challenges v1.5 — receive flow. Mirrors ShareReceiver
// (single-listing receive) for two challenge-share modes:
//
//   Mode "spec"     — sender hit "Share as challenge" on a draft or
//                     completed challenge. URL carries the
//                     constraints: `?newchallenge=1&t=…&n=…&b=…&d=…`.
//                     Recipient sees "Take this challenge" and can
//                     start a fresh one with the same constraints.
//   Mode "complete" — sender hit "Share as completed". URL =
//                     `?challenge=<id>&shared=1`. Recipient fetches
//                     the picks via the public read RPC and sees the
//                     sender's submission. They can still take the
//                     challenge themselves under the same constraints.
//
// All hooks live INSIDE this component. App.js mounts it
// unconditionally and only mirrors a one-bit `challengeShareActive`
// flag back up so the shell can hide its browse chrome — same
// pattern as ShareReceiver. Returns null when neither URL pattern
// matches.

export function ChallengeReceiver({
  user,
  isAuthConfigured,
  signInWithGoogle,
  collectionsApi,
  // App.js mirrors active state so the shell hides browse chrome
  // while the focused landing surface is up.
  setChallengeShareActive,
  // Navigation hooks for orientation CTAs.
  setTab,
  // App.js increments this when the user explicitly navigates away
  // from the share-receive surface via main-nav (Watchlist logo,
  // top tabs). We watch it and clear our intent state — the flag
  // alone going to false isn't enough because we control it.
  resetTick,
  // After "Take this challenge" creates a fresh challenge owned by
  // the recipient, App.js wants to drill straight in (instead of
  // dropping them on the references-tab list). We hand back the
  // new challenge id; App.js handles the navigation + drill.
  onTakenChallenge,
}) {
  // intent: { mode: "spec" | "complete", spec?, id? }
  const [intent, setIntent] = useState(null);
  const [completeData, setCompleteData] = useState(null);
  const [completeError, setCompleteError] = useState("");
  const [busy, setBusy] = useState(false);

  // Parse URL on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("newchallenge") === "1") {
        const t = params.get("t") || "";
        const n = parseInt(params.get("n") || "0", 10);
        const b = parseInt(params.get("b") || "0", 10);
        const d = params.get("d") || "";
        if (n > 0 && b > 0) {
          setIntent({ mode: "spec", spec: { name: t, targetCount: n, budget: b, descriptionLong: d } });
        }
      } else if (params.get("challenge") && params.get("shared") === "1") {
        setIntent({ mode: "complete", id: params.get("challenge") });
      }
    } catch (e) {
      console.warn("challenge URL parse failed", e);
    }
  }, []);

  // Mirror to parent for shell chrome gating.
  useEffect(() => {
    if (typeof setChallengeShareActive === "function") {
      setChallengeShareActive(!!intent);
    }
  }, [intent, setChallengeShareActive]);

  // External escape signal — clear intent on bump.
  useEffect(() => {
    if (resetTick && resetTick > 0) {
      setIntent(null);
      setCompleteData(null);
      setCompleteError("");
    }
  }, [resetTick]);

  // Fetch the public-read challenge for "complete" mode. Anonymous-
  // safe (RPC's anon grant). state='complete' gate is inside the
  // function, so drafts return null silently.
  useEffect(() => {
    if (!intent || intent.mode !== "complete") return undefined;
    if (!supabase) {
      setCompleteError("Supabase not configured.");
      return undefined;
    }
    let cancelled = false;
    supabase.rpc("get_public_challenge", { challenge_id: intent.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setCompleteError(error.message || "Failed to load."); return; }
        if (!data) { setCompleteError("This challenge isn't available — it might still be a draft, or the link is wrong."); return; }
        setCompleteData(data);
      });
    return () => { cancelled = true; };
  }, [intent]);

  const clearIntent = useCallback(() => {
    setIntent(null);
    setCompleteData(null);
    setCompleteError("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("newchallenge");
      url.searchParams.delete("challenge");
      url.searchParams.delete("shared");
      url.searchParams.delete("t");
      url.searchParams.delete("n");
      url.searchParams.delete("b");
      url.searchParams.delete("d");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const onClickAnchor = useCallback((tab) => {
    clearIntent();
    if (typeof setTab === "function") setTab(tab);
  }, [clearIntent, setTab]);

  // "Take this challenge" — creates a new challenge owned by the
  // recipient with the same constraints, then drops them into Cool
  // Stuff > Challenges so they can start picking. Spec mode uses
  // the URL params; complete mode uses the fetched challenge data.
  const onTakeChallenge = useCallback(async () => {
    if (!user) return;
    if (!collectionsApi?.createChallenge) return;
    let spec;
    if (intent?.mode === "spec") {
      spec = intent.spec;
    } else if (intent?.mode === "complete" && completeData) {
      spec = {
        name:            completeData.name,
        targetCount:     completeData.targetCount,
        budget:          completeData.budget,
        descriptionLong: completeData.descriptionLong || null,
      };
    }
    if (!spec) return;
    setBusy(true);
    let createdId = null;
    try {
      const res = await collectionsApi.createChallenge({
        name:            spec.name || `${spec.targetCount} watches for $${(spec.budget / 1000).toFixed(0)}k`,
        targetCount:     spec.targetCount,
        budget:          spec.budget,
        descriptionLong: spec.descriptionLong || null,
      });
      if (res?.error) {
        console.warn("take-challenge create failed", res.error);
      } else if (res?.id) {
        createdId = res.id;
      }
    } catch (e) {
      console.warn("take-challenge", e);
    }
    setBusy(false);
    clearIntent();
    // Hand the new challenge back to App.js so it can drill straight
    // in. Falls back to the references-tab list if the parent didn't
    // wire onTakenChallenge.
    if (createdId && typeof onTakenChallenge === "function") {
      onTakenChallenge(createdId);
    } else if (typeof setTab === "function") {
      setTab("references");
    }
  }, [user, collectionsApi, intent, completeData, clearIntent, setTab, onTakenChallenge]);

  if (!intent) return null;

  // ── Render branches ──────────────────────────────────────────
  const isSpec = intent.mode === "spec";
  const spec = isSpec ? intent.spec : completeData;

  // Complete mode is still loading.
  if (!isSpec && !completeData && !completeError) {
    return (
      <div style={landingPaneStyle()}>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>Loading challenge…</p>
      </div>
    );
  }
  // Complete mode failed.
  if (!isSpec && completeError) {
    return (
      <div style={landingPaneStyle()}>
        <FocusedHeader title="Challenge unavailable" />
        <div style={{
          padding: "24px 22px",
          border: "0.5px solid var(--border)",
          borderRadius: 12, background: "var(--card-bg)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)",
          marginBottom: 18,
        }}>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, margin: 0 }}>
            {completeError}
          </p>
        </div>
        <OrientationAnchors
          signedIn={!!user}
          onClickAnchor={onClickAnchor}
          onSignIn={isAuthConfigured ? signInWithGoogle : undefined}
          signInCopy="Sign in to save searches, take on challenges, and build your lists."
        />
      </div>
    );
  }

  const budget = spec?.budget || 0;
  const targetCount = spec?.targetCount || 0;
  const subtitle = `${targetCount} watch${targetCount === 1 ? "" : "es"} for ${fmtUSD(budget)}`;

  return (
    <div style={landingPaneStyle()}>
      <FocusedHeader
        title={isSpec
          ? "Someone challenged you on Watchlist."
          : "Someone shared a completed challenge on Watchlist."}
      />

      <div className="challenge-receiver-grid" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 16, alignItems: "stretch",
        marginBottom: 14,
      }}>
        <style>{`
          @media (min-width: 1100px) {
            .challenge-receiver-grid {
              grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr) !important;
            }
          }
        `}</style>

        {/* Main card — constraints + picks (when complete) */}
        <div style={focusedCardStyle()}>
          <div style={{
            padding: "16px 18px 14px",
            borderBottom: "0.5px solid var(--border)",
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap",
          }}>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: 11, fontWeight: 600, color: "var(--text2)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                margin: "0 0 4px",
              }}>
                {isSpec ? "Watch challenge" : "Watch challenge · complete"}
              </p>
              <h2 style={{
                fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text1)",
                lineHeight: 1.25,
                overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {spec?.name || subtitle}
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, whiteSpace: "nowrap" }}>
              {subtitle}
            </p>
          </div>

          {/* Picks (complete mode only) */}
          {!isSpec && Array.isArray(completeData?.picks) && completeData.picks.length > 0 ? (
            <div style={{ padding: "14px 18px" }}>
              {completeData.picks.map((p, i) => (
                <div key={p.rowId || i} style={{
                  display: "grid", gridTemplateColumns: "56px 1fr auto",
                  gap: 12, alignItems: "center",
                  paddingBottom: 12, marginBottom: 12,
                  borderBottom: i < completeData.picks.length - 1
                    ? "0.5px solid var(--border)" : "none",
                }}>
                  <PickThumbnail snapshot={p.snapshot} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text1)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.snapshot?.brand || ""} {p.snapshot?.ref || ""}
                    </p>
                    <p style={{
                      fontSize: 12, color: "var(--text2)", margin: "1px 0 0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.snapshot?.source || ""}
                    </p>
                  </div>
                  <p style={{
                    fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text1)",
                    whiteSpace: "nowrap",
                  }}>
                    {fmtUSD(p.savedPriceUSD || 0)}
                  </p>
                </div>
              ))}
              {completeData?.descriptionLong && (
                <p style={{
                  fontSize: 13, color: "var(--text2)", lineHeight: 1.5,
                  margin: "6px 0 0", fontStyle: "italic",
                  borderTop: "0.5px solid var(--border)", paddingTop: 10,
                }}>
                  "{completeData.descriptionLong}"
                </p>
              )}
            </div>
          ) : isSpec ? (
            <div style={{ padding: "16px 18px", color: "var(--text2)", fontSize: 14, lineHeight: 1.55 }}>
              The sender wants you to build your own answer under the same constraints —
              <strong style={{ color: "var(--text1)" }}> pick {targetCount} {targetCount === 1 ? "watch" : "watches"} for {fmtUSD(budget)}</strong>.
              You can still go over by 20% (soft cap).
              {spec?.descriptionLong && (
                <p style={{ marginTop: 10, fontStyle: "italic" }}>"{spec.descriptionLong}"</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Right column — actions + onboarding */}
        <div style={focusedCardStyle()}>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{
              fontSize: 11, fontWeight: 600, color: "var(--text3)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              margin: 0,
            }}>
              {user ? "Your move" : "How to take it on"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, margin: 0 }}>
              {isSpec
                ? "Pick the watches you'd choose under these constraints — share back when you're done."
                : "Build your own answer under the same constraints — pick your watches, share back."
              }
            </p>
            {user ? (
              <button onClick={onTakeChallenge} disabled={busy} style={primaryBtnStyle(busy)}>
                {busy ? "Creating…" : "Take this challenge →"}
              </button>
            ) : isAuthConfigured && signInWithGoogle ? (
              <button onClick={signInWithGoogle} style={primaryBtnStyle(false)}>
                Sign in to take this on
              </button>
            ) : null}
            <button onClick={() => onClickAnchor("listings")} style={secondaryBtnStyle}>
              Just browse Watchlist
            </button>
            {!user && (
              <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, margin: "4px 0 0" }}>
                No account is needed to browse — sign in only if you want to take the challenge.
              </p>
            )}
          </div>
        </div>
      </div>

      <OrientationAnchors
        signedIn={!!user}
        onClickAnchor={onClickAnchor}
        onSignIn={isAuthConfigured ? signInWithGoogle : undefined}
        signInCopy={
          isSpec
            ? "Sign in to take this challenge, save searches, and build your lists."
            : "Sign in to save this collection, follow searches, and build your lists."
        }
      />
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────

function FocusedHeader({ title }) {
  return (
    <h1 style={{
      fontSize: 17, fontWeight: 600,
      color: "var(--text1)", margin: "0 0 14px", lineHeight: 1.3,
    }}>{title}</h1>
  );
}

function PickThumbnail({ snapshot }) {
  return (
    <div style={{
      aspectRatio: "1", background: "var(--bg)", borderRadius: 6,
      overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {snapshot?.img ? (
        <img src={imgSrc(snapshot.img)} alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: 18, color: "var(--text3)" }}>⌚</span>
      )}
    </div>
  );
}

function OrientationAnchors({ signedIn, onClickAnchor, onSignIn, signInCopy }) {
  const showSignIn = !signedIn && onSignIn;
  return (
    <div style={{ ...focusedCardStyle(), overflow: "hidden" }}>
      {showSignIn && (
        <div style={{
          padding: "16px 18px 14px",
          borderBottom: "0.5px solid var(--border)",
          background: "var(--surface)",
        }}>
          <p style={{
            fontSize: 11, fontWeight: 600, color: "var(--text3)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            margin: "0 0 8px",
          }}>
            Sign in
          </p>
          <p style={{
            fontSize: 13, color: "var(--text2)", margin: "0 0 12px",
            lineHeight: 1.5,
          }}>
            {signInCopy || (
              <>Sign in to take this challenge, save searches, and build your lists.</>
            )}
          </p>
          <button onClick={onSignIn} style={primaryBtnStyle(false)}>
            Sign in to Watchlist →
          </button>
        </div>
      )}
      <div style={{ padding: "16px 18px 14px" }}>
        <p style={{
          fontSize: 11, fontWeight: 600, color: "var(--text3)",
          textTransform: "uppercase", letterSpacing: "0.06em",
          margin: "0 0 8px",
        }}>
          First time on Watchlist?
        </p>
        <p style={{
          fontSize: 13, color: "var(--text2)", margin: "0 0 12px",
          lineHeight: 1.5,
        }}>
          Watchlist is a vintage watch aggregator from independent dealers and auction
          houses. One feed to manage watchlists, no ads, and it's free.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => onClickAnchor("listings")} style={anchorBtnStyle}>
            Browse all listings →
          </button>
          {signedIn && (
            <button onClick={() => onClickAnchor("watchlist")} style={anchorBtnStyle}>
              Go to your saved list →
            </button>
          )}
          <button onClick={() => onClickAnchor("references")} style={anchorBtnStyle}>
            Cool stuff (tools + links) →
          </button>
        </div>
      </div>
    </div>
  );
}

const landingPaneStyle = () => ({
  padding: "16px 16px 110px",
  maxWidth: 1600,
  margin: "0 auto",
  width: "100%",
});

const focusedCardStyle = () => ({
  background: "var(--card-bg)",
  borderRadius: 12, border: "0.5px solid var(--border)",
  boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)",
  overflow: "hidden",
});

const primaryBtnStyle = (busy) => ({
  border: "none",
  background: "#185FA5",
  color: "#fff",
  padding: "10px 18px",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  cursor: busy ? "wait" : "pointer",
  opacity: busy ? 0.6 : 1,
});

const secondaryBtnStyle = {
  border: "0.5px solid var(--border)",
  background: "transparent",
  color: "var(--text2)",
  padding: "10px 18px",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 14,
  cursor: "pointer",
};

const anchorBtnStyle = {
  border: "0.5px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text1)",
  padding: "8px 14px",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
};
