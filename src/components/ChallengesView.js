import React, { useState } from "react";
import { ChallengeFlow, CreateStage } from "./ChallengeFlow";
import { ListRow } from "./ListRow";
import { fmtUSD } from "../utils";
import { signInButton } from "../styles";
import { EmptyState } from "./EmptyState";
import { SubTabIntro } from "./SubTabIntro";

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
      <EmptyState
        size="tall"
        heading="Sign in to build a challenge"
        blurb="Build a constrained list: pick N watches under a budget. Save it, share it, ask a friend to fill in their own answer. Your challenges sync across every device you use."
        action={isAuthConfigured && (
          <button onClick={signInWithGoogle} style={signInButton}>Sign in</button>
        )}
      />
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
          user={user}
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

  const [createError, setCreateError] = useState("");
  const submitNewChallenge = async (config) => {
    setCreateError("");
    const res = await collectionsApi.createChallenge(config);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    setCreatingNew(false);
    setSelectedChallengeId(res.id);
  };

  if (creatingNew) {
    return (
      <div style={{ paddingTop: 4 }}>
        {createError && (
          <div style={{
            fontSize: 12, color: "var(--danger)",
            padding: "8px 12px", marginBottom: 10,
            border: "0.5px solid var(--danger)", borderRadius: 8,
            background: "var(--card-bg)",
          }}>
            Challenge didn't save — {createError}
          </div>
        )}
        <CreateStage
          challenge={null}
          onSubmit={submitNewChallenge}
          onCancel={() => { setCreateError(""); setCreatingNew(false); }}
        />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Back button (drill-in only) sits above the SubTabIntro so
          navigation remains the first thing the user sees. */}
      {onBack && (
        <div style={{ marginBottom: 8 }}>
          <button onClick={onBack} aria-label="Back" style={{
            border: "none", background: "transparent", color: "var(--text2)",
            cursor: "pointer", fontFamily: "inherit", fontSize: 13,
            padding: 0, display: "flex", alignItems: "center", gap: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back
          </button>
        </div>
      )}
      {/* Intro banner consistent with Lists / Searches / My Watches
          (2026-05-09 — Mark feedback: sub-tabs jumped vertically as
          you switched). Collapsed when you have content; expanded
          when empty so first-timers see the explainer. */}
      <SubTabIntro
        title={`Challenges · ${allChallenges.length}`}
        blurb={<>
          Build a virtual collection within constraints — "5 watches, $50k
          total" or "3 chronographs from before 1970". Pick from the feed,
          share the spec with a friend, see what they'd pick under the same
          rules. A pure thought experiment, no money moves.
          <br/>
          Tap <strong>+ New challenge</strong> to set the rules; pick from
          your hearts or the live feed; share the result via the native
          share sheet. Friends who open your link land on the same picker
          and can save their own version back.
        </>}
        actionLabel="+ New challenge"
        onAction={handleNewChallenge}
        expandable
        defaultExpanded={allChallenges.length === 0}
      />

      {allChallenges.length === 0 ? (
        <EmptyState
          heading="No challenges yet"
          blurb="Create a virtual collection. Share your picks. Challenge someone else to do the same under your constraints."
        />
      ) : (() => {
        // PR #90 grouping: split sender-attributed (Sent to you) from
        // self-created (Yours). Within each group, ordering matches
        // the underlying allChallenges order. Mark's framing: "Be
        // good to save a completed challenge with a name - James's 3
        // watch collection for $50k and have a saved challenges
        // section."
        const sentToYou = allChallenges.filter(c => c.senderName);
        const yours     = allChallenges.filter(c => !c.senderName);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {sentToYou.length > 0 && (
              <div>
                <SectionHeader>Sent to you · {sentToYou.length}</SectionHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sentToYou.map(renderChallengeRow)}
                </div>
              </div>
            )}
            {yours.length > 0 && (
              <div>
                {sentToYou.length > 0 && <SectionHeader>Yours · {yours.length}</SectionHeader>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {yours.map(renderChallengeRow)}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );

  // Single render for both groupings — keeps the row visual identical
  // whether it's "from you" or "sent to you" except for the small
  // attribution chip in the title.
  function renderChallengeRow(c) {
            const items = itemsByColl[c.id] || [];
            const picks = items.filter(it => it.isPick);
            const totalSpend = picks.reduce((s, p) => s + (p.savedPriceUSD || p.priceUSD || 0), 0);
            const remaining = (c.budget || 0) - totalSpend;
            const isDraft = c.state === "draft";
            // Disc tint carries the draft-vs-complete signal —
            // gold for draft, blue for complete.
            const accent = isDraft ? "#c9a227" : "var(--brand)";
            const subtitle = c.targetCount && c.budget ? (
              <>
                {picks.length} of {c.targetCount} picks
                {" · "}{fmtUSD(totalSpend)} spent
                {" · "}<strong style={{ color: remaining < 0 ? "#c9a227" : "var(--text2)", fontWeight: 500 }}>
                  {remaining < 0 ? `${fmtUSD(-remaining)} over` : `${fmtUSD(remaining)} left`}
                </strong>
              </>
            ) : (
              <>Set the constraints to start</>
            );
            const title = (
              <>
                {c.name}
                {isDraft && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 600,
                    padding: "1px 6px", borderRadius: 3,
                    background: "rgba(201,162,39,0.15)", color: "#c9a227",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>Draft</span>
                )}
                {/* Attribution chip — small inline badge so each row
                    can stand alone if the section header scrolls
                    off. PR #90. */}
                {c.senderName && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 500,
                    padding: "1px 6px", borderRadius: 3,
                    background: "rgba(24,95,165,0.10)", color: "var(--brand)",
                  }}>from {c.senderName}</span>
                )}
              </>
            );
            // Mark feedback 2026-05-07: dropped the bullseye/target
            // glyph. Glyph swapped for a clean stack-of-watches mark
            // (same outline weight + accent color as the prior
            // concentric-circles target). If a future challenge
            // typology needs a glyph, ship one specific to the
            // challenge — don't bring back the bullseye.
            const icon = (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="4" rx="1"/>
                <rect x="4" y="10" width="16" height="4" rx="1"/>
                <rect x="4" y="16" width="16" height="4" rx="1"/>
              </svg>
            );
            // PR #92 (Mark 2026-05-06): "On the challenges list it
            // would be good to have the delete and share buttons
            // back." Restored as ListRow `actions` — icon-only,
            // sized to match the chevron weight.
            const handleShareRow = async () => {
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
            const handleDeleteRow = async () => {
              if (!collectionsApi?.deleteCollection) return;
              const ok = window.confirm(`Delete "${c.name}"? This can't be undone.`);
              if (!ok) return;
              await collectionsApi.deleteCollection(c.id);
            };
            const actions = [];
            if (handleShare) actions.push({
              ariaLabel: `Share ${c.name}`,
              title: "Share challenge",
              icon: shareIcon,
              onClick: handleShareRow,
            });
            if (collectionsApi?.deleteCollection) actions.push({
              ariaLabel: `Delete ${c.name}`,
              title: "Delete challenge",
              icon: trashIcon,
              onClick: handleDeleteRow,
            });
            return (
              <ListRow key={c.id}
                icon={icon}
                accent={accent}
                title={title}
                subtitle={subtitle}
                ariaLabel={`Open challenge: ${c.name}`}
                onClick={() => setSelectedChallengeId(c.id)}
                actions={actions}
              />
            );
  }
}

const shareIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const trashIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
  </svg>
);

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: "var(--text3)",
      textTransform: "uppercase", letterSpacing: "0.04em",
      padding: "0 4px 8px",
    }}>{children}</div>
  );
}
