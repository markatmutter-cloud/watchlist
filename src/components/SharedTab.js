import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { EmptyState } from "./EmptyState";
import { signInButton } from "../styles";

// Top-level Share tab — the landing surface for lists you've sent
// out + lists people have shared with you. Per Mark spec 2026-05-12:
// "shared lists deserve their own home, not retrofitted onto Lists."
//
// This iteration is the scaffold. Two sections:
//   1. Shared with you — lists where you're a collaborator but not the
//      owner. Tap a row to drill into the standard Lists drill-in
//      (which already carries the recipient banner + 📋 To-review
//      bucket + review-mode CTA from PRs #245 / #246).
//   2. Shared by you — lists you own that have at least one
//      collaborator on them. Same row tap navigates to the drill-in.
//
// Future iterations layer in:
//   - Send wizard (pick list → pick recipients → set permission → send)
//   - Tally view for poll-mode lists
//   - Comments on items
//   - Challenges moved here from Watchlist > Challenges
//
// `openSharedList(listId)` is the parent-supplied callback that
// navigates to Watchlists > Lists > [drill-in] for the given id.

export function SharedTab({
  user,
  cols,
  itemsByColl,
  signInWithGoogle,
  isAuthConfigured,
  openSharedList,
}) {
  // Set of collection_ids the current user is a member of (owner OR
  // accepted collaborator — RLS scopes the query to "rows I can see").
  // Same fetch ListsView does; lifted here so SharedTab is independent.
  const [collaboratorIds, setCollaboratorIds] = useState(() => new Set());

  useEffect(() => {
    if (!user || !supabase) {
      setCollaboratorIds(new Set());
      return undefined;
    }
    let cancelled = false;
    supabase.from("collection_collaborators")
      .select("collection_id")
      .eq("status", "accepted")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.warn("shared-lists load failed", error);
          return;
        }
        setCollaboratorIds(new Set((data || []).map(r => r.collection_id)));
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <EmptyState
          size="tall"
          heading="Sign in to share lists"
          blurb="Send a list to a friend or watch club to get reactions, votes, or just a second opinion. Lists shared with you land here too — open them to react ❤️ / 👍 / ❌ on each watch."
          action={isAuthConfigured && (
            <button onClick={signInWithGoogle} style={signInButton}>Sign in</button>
          )}
        />
      </div>
    );
  }

  // Lists shared with me — owned by someone else, surfaced because RLS
  // gave me access via collection_collaborators OR because the inbox
  // row was returned.
  const sharedWithMe = (cols || []).filter(c =>
    !c.isSystem
    && c.type !== "challenge"
    && (c.isSharedInbox || (c.userId && user.id && c.userId !== user.id))
  );

  // Lists I own that I've shared (have at least one accepted
  // collaborator). collaboratorIds carries every collection_id I can
  // see in collection_collaborators — including my own lists where I
  // added a collaborator, since I'm party to that row.
  const sharedByMe = (cols || []).filter(c =>
    !c.isSystem
    && c.type !== "challenge"
    && !c.isSharedInbox
    && c.userId === user.id
    && collaboratorIds.has(c.id)
  );

  const listRow = (c, opts = {}) => {
    const count = c.isSharedInbox
      ? (itemsByColl[c.id] || []).length
      : (itemsByColl[c.id] || []).length;
    return (
      <button key={c.id}
        onClick={() => openSharedList?.(c.id)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
          width: "100%", textAlign: "left",
          padding: "14px 16px",
          borderRadius: 10,
          border: "0.5px solid var(--border)",
          background: "var(--surface)", color: "var(--text1)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {count} watch{count === 1 ? "" : "es"}
            {opts.subtitle && <> · {opts.subtitle}</>}
          </div>
        </div>
        <span aria-hidden style={{ fontSize: 14, color: "var(--text3)", flexShrink: 0 }}>›</span>
      </button>
    );
  };

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Page intro — kept short. The two sections below carry the
          actual work; no need for a heavy preamble here. */}
      <div style={{
        margin: "0 0 14px",
        padding: "12px 14px",
        borderRadius: 10,
        border: "0.5px solid var(--border)",
        background: "var(--surface)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 4 }}>
          Share & collaborate
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text2)" }}>
          Send a list to a friend for their take, or get a group to vote on a
          shortlist. Lists shared with you appear here — react ❤️ / 👍 / ❌
          on each watch, or open the one-at-a-time review mode.
        </div>
      </div>

      {/* SECTION 1 — Shared with me */}
      <SectionHeader title="Shared with you" count={sharedWithMe.length} />
      {sharedWithMe.length === 0 ? (
        <EmptyState
          icon="📨"
          heading="Nothing shared with you yet"
          blurb="When someone sends you a list via Watchlist, it'll land here. Open it to react on each watch."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {sharedWithMe.map(c => listRow(c, {
            subtitle: c.isSharedInbox
              ? "Shared inbox"
              : c.userId
                ? "Shared with you"
                : undefined,
          }))}
        </div>
      )}

      {/* SECTION 2 — Shared by me */}
      <SectionHeader title="Shared by you" count={sharedByMe.length} />
      {sharedByMe.length === 0 ? (
        <EmptyState
          icon="🤝"
          heading="You haven't shared any lists yet"
          blurb={<>Open any list under <strong>Watchlists › Lists</strong> and tap <em>Share</em> to send it to a friend, or use the ⋯ menu to add collaborators who can react alongside you.</>}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {sharedByMe.map(c => listRow(c, { subtitle: "Shared by you" }))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 12,
      padding: "8px 4px 10px",
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>
        {title}
      </span>
      <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: "auto" }}>
        {count}
      </span>
    </div>
  );
}
