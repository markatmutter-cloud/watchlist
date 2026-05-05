import React, { useState } from "react";
import { ChallengeFlow } from "./ChallengeFlow";
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
  onBack,
}) {
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);

  if (!user) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
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

  const handleNewChallenge = async () => {
    const res = await collectionsApi.createChallenge({
      name: "",                  // becomes auto-titled "N watches for $Xk"
      targetCount: null,         // null targetCount triggers Create stage
      budget: null,
    });
    if (res.error) {
      window.alert("Couldn't create challenge: " + res.error);
      return;
    }
    setSelectedChallengeId(res.id);
  };

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, gap: 8, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {onBack && (
            <button onClick={onBack} aria-label="Back to References" style={{
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
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--text1)" }}>
            No challenges yet
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
            Pick N watches under a budget. Useful as a thought experiment, a way to surface taste,
            or a question to send a friend. Tap "+ New challenge" to start.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allChallenges.map(c => {
            const items = itemsByColl[c.id] || [];
            const picks = items.filter(it => it.isPick);
            const totalSpend = picks.reduce((s, p) => s + (p.savedPriceUSD || p.priceUSD || 0), 0);
            const isDraft = c.state === "draft";
            return (
              <button key={c.id}
                onClick={() => setSelectedChallengeId(c.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: 12,
                  border: "0.5px solid var(--border)",
                  borderLeft: `3px solid ${isDraft ? "#c9a227" : "#185FA5"}`,
                  background: "var(--card-bg)",
                  color: "var(--text1)", cursor: "pointer",
                  fontFamily: "inherit", textAlign: "left", gap: 10,
                }}>
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
                        {picks.length} of {c.targetCount} picks · {fmtUSD(totalSpend)} of {fmtUSD(c.budget)}
                      </>
                    ) : (
                      <>Set the constraints to start</>
                    )}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
