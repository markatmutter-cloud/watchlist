import React, { useState } from "react";
import { ChallengeFlow, CreateStage } from "./ChallengeFlow";
import { fmtUSD } from "../utils";

// Challenges view — extracted from WatchlistTab.js on 2026-05-04
// when Challenges moved from a Watchlist sub-tab to a resource under
// the References tab.
//
// Renders a list of the user's challenges (Build-a-collection v1
// drafts + completed). Drilling into a challenge mounts ChallengeFlow,
// which owns the multi-stage Create → Picking → Reasoning → Complete
// flow. Selection state is component-local (no URL persistence in
// this iteration — different from the Lists drill-in which keeps
// `?col=<uuid>`).
//
// Props are the same set the WatchlistTab challenges block needed:
// user (for the sign-in gate), collectionsApi (createChallenge,
// collections, itemsByCollection), allListings (for ChallengeFlow's
// add-to-shortlist drawer), watchlist + hidden (also for that
// drawer), primaryCurrency, handleShare, isAuthConfigured +
// signInWithGoogle (for the sign-in prompt).
export function ChallengesView({
  user,
  isAuthConfigured,
  signInWithGoogle,
  collectionsApi,
  allListings,
  watchlist,
  hidden,
  primaryCurrency,
  handleShare,
  // After "Take this challenge" on a shared receive surface the
  // recipient gets a freshly-created challenge — App.js sets this
  // and we drill straight in (instead of leaving them on the list).
  // Mark D5 (2026-05-06): "When I click take this challenge it
  // goes to cool stuff not the challenge — this needs fixing!"
  pendingChallengeDrillId,
  clearPendingChallengeDrill,
  onBack,
}) {
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);

  React.useEffect(() => {
    if (pendingChallengeDrillId) {
      setSelectedChallengeId(pendingChallengeDrillId);
      if (typeof clearPendingChallengeDrill === "function") {
        clearPendingChallengeDrill();
      }
    }
  }, [pendingChallengeDrillId, clearPendingChallengeDrill]);
  // "+ New challenge" used to insert an empty Supabase row immediately
  // and route the user into the now-orphaned-on-cancel CreateStage.
  // creatingNew=true now renders CreateStage WITHOUT a row, and the
  // create only happens on form submit. Cancel just clears the flag.
  const [creatingNew, setCreatingNew] = useState(false);

  if (!user) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Sign in to build a challenge</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 340, margin: "0 auto 18px" }}>
          Build a constrained list: pick N watches under a budget. Save it, share it, ask a friend to fill in their own answer. Your challenges sync across every device you use.
        </div>
        {isAuthConfigured && (
          <button onClick={signInWithGoogle} style={{
            padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--border)",
            background: "var(--card-bg)", color: "var(--text1)", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
          }}>Sign in with Google</button>
        )}
      </div>
    );
  }

  const allChallenges = (collectionsApi?.collections || [])
    .filter(c => c.type === "challenge");
  const itemsByColl = collectionsApi?.itemsByCollection || {};
  const selected = selectedChallengeId
    ? allChallenges.find(c => c.id === selectedChallengeId)
    : null;

  if (selected) {
    const items = itemsByColl[selected.id] || [];
    return (
      <div style={{ paddingTop: 4 }}>
        <ChallengeFlow
          challenge={selected}
          items={items}
          allListings={allListings || []}
          watchlist={watchlist}
          hidden={hidden || {}}
          primaryCurrency={primaryCurrency}
          collectionsApi={collectionsApi}
          handleShare={handleShare}
          onExit={() => setSelectedChallengeId(null)}
        />
      </div>
    );
  }

  const handleNewChallenge = () => {
    // No DB write here — CreateStage's onSubmit calls
    // submitNewChallenge below, which is the only path that creates
    // a row. Avoids polluting the list with empty drafts when the
    // user opens the form and changes their mind.
    setCreatingNew(true);
  };

  const submitNewChallenge = async (config) => {
    const res = await collectionsApi.createChallenge(config);
    if (res.error) {
      window.alert("Couldn't create challenge: " + res.error);
      return;
    }
    setCreatingNew(false);
    setSelectedChallengeId(res.id);
  };

  if (creatingNew) {
    return (
      <div style={{ paddingTop: 4 }}>
        <CreateStage
          challenge={null}
          onSubmit={submitNewChallenge}
          onCancel={() => setCreatingNew(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, gap: 8, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {onBack && (
            <button onClick={onBack} aria-label="Back to Cool Stuff" style={{
              border: "none", background: "transparent", color: "var(--text2)",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              padding: 0, display: "flex", alignItems: "center", gap: 4,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>
          )}
          <p style={{
            fontSize: 12, fontWeight: 600, color: "var(--text2)",
            textTransform: "uppercase", letterSpacing: "0.04em", margin: 0,
          }}>
            Challenges · {allChallenges.length}
          </p>
        </div>
        <button onClick={handleNewChallenge} style={{
          padding: "7px 14px", borderRadius: 8,
          border: "0.5px solid var(--border)",
          background: "var(--surface)", color: "var(--text1)",
          cursor: "pointer", fontFamily: "inherit", fontSize: 13,
        }}>+ New challenge</button>
      </div>

      {allChallenges.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
            No challenges yet
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
            Create a virtual collection. Share your picks. Challenge someone else to do the
            same under your constraints.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allChallenges.map(c => {
            const items = itemsByColl[c.id] || [];
            const picks = items.filter(it => it.isPick);
            const totalSpend = picks.reduce((s, p) => s + (p.savedPriceUSD || p.priceUSD || 0), 0);
            const remaining = (c.budget || 0) - totalSpend;
            const isDraft = c.state === "draft";
            const handleDelete = async (e) => {
              e.stopPropagation();
              if (!collectionsApi?.deleteCollection) return;
              const ok = window.confirm(
                `Delete "${c.name}"? This can't be undone.`
              );
              if (!ok) return;
              await collectionsApi.deleteCollection(c.id);
            };
            // Quick-share from the list row — same URL shape as
            // ChallengeFlow.shareChallenge so the recipient experience
            // is consistent. Mark 2026-05-06: "Share button should
            // also be where you have delete on challenges."
            // List-row share. v1.5: completed challenges share with
            // picks visible (?challenge=<id>&shared=1 — fetched via
            // get_public_challenge RPC); drafts can only share the
            // constraints since there are no picks to surface yet.
            // For more granular control (constraints-only on a
            // completed challenge), the user drills in and uses
            // CompleteStage which exposes both buttons.
            const handleShareRow = async (e) => {
              e.stopPropagation();
              if (!handleShare) return;
              let url;
              if (c.state === "complete") {
                url = `${window.location.origin}/?challenge=${encodeURIComponent(c.id)}&shared=1`;
              } else {
                const params = new URLSearchParams();
                params.set("newchallenge", "1");
                if (c.name)             params.set("t", c.name);
                if (c.targetCount)      params.set("n", String(c.targetCount));
                if (c.budget)           params.set("b", String(c.budget));
                if (c.descriptionLong)  params.set("d", c.descriptionLong);
                url = `${window.location.origin}/?${params.toString()}`;
              }
              await handleShare({ title: `Watch challenge: ${c.name}`, url });
            };
            // Disc tint signals draft vs complete (replaces the
            // left-border accent in the prior design, which made the
            // row look distinct from Lists rows). Gold for draft,
            // blue for complete — same tokens as before.
            const accent = isDraft ? "#c9a227" : "#185FA5";
            const accentTint = isDraft ? "rgba(201,162,39,0.10)" : "rgba(24,95,165,0.08)";
            return (
              <div key={c.id}
                onClick={() => setSelectedChallengeId(c.id)}
                role="button" tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedChallengeId(c.id);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: 12,
                  border: "0.5px solid var(--border)",
                  background: "var(--card-bg)",
                  color: "var(--text1)", cursor: "pointer",
                  fontFamily: "inherit", textAlign: "left", gap: 10,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                  {/* Icon disc — matches Lists row pattern. Tinted
                      with the draft/complete accent so the state
                      signal lives on the disc instead of a left
                      border. Glyph is a target (challenge concept). */}
                  <div style={{
                    flexShrink: 0,
                    width: 36, height: 36, borderRadius: "50%",
                    background: accentTint,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <circle cx="12" cy="12" r="6"/>
                      <circle cx="12" cy="12" r="2"/>
                    </svg>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                      {isDraft && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, fontWeight: 600,
                          padding: "1px 6px", borderRadius: 3,
                          background: "rgba(201,162,39,0.15)", color: "#c9a227",
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>Draft</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>
                      {c.targetCount && c.budget ? (
                        <>
                          {picks.length} of {c.targetCount} picks
                          {" · "}{fmtUSD(totalSpend)} spent
                          {" · "}<strong style={{ color: remaining < 0 ? "#c9a227" : "var(--text2)", fontWeight: 500 }}>
                            {remaining < 0 ? `${fmtUSD(-remaining)} over` : `${fmtUSD(remaining)} left`}
                          </strong>
                        </>
                      ) : (
                        <>Set the constraints to start</>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {/* Icon-only action buttons — same visual weight as
                      the trailing chevron so they don't dominate the
                      row. Keeps the share + delete affordances Mark
                      added in PR #71/#76 without breaking the Lists
                      row aesthetic. */}
                  {handleShare && (
                    <button
                      onClick={handleShareRow}
                      aria-label={`Share ${c.name}`}
                      title="Share challenge"
                      style={iconBtnStyle}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                        <polyline points="16 6 12 2 8 6"/>
                        <line x1="12" y1="2" x2="12" y2="15"/>
                      </svg>
                    </button>
                  )}
                  {collectionsApi?.deleteCollection && (
                    <button
                      onClick={handleDelete}
                      aria-label={`Delete ${c.name}`}
                      title="Delete challenge"
                      style={iconBtnStyle}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: 4 }}><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  width: 28, height: 28,
  display: "flex", alignItems: "center", justifyContent: "center",
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  borderRadius: 6,
  padding: 0,
  fontFamily: "inherit",
};
