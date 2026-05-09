import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { fmt, fmtUSD, imgSrc } from "../utils";
import { signInButton as primaryBtnStyle } from "../styles";

// List-share v1 receive flow. Mirrors ChallengeReceiver / ShareReceiver
// pattern — all hooks live INSIDE this component; App.js only mirrors a
// one-bit `listShareActive` flag back up so the shell hides browse
// chrome while the focused landing surface is up.
//
// URL pattern: `?list=<uuid>&shared=1`. The list is fetched via the
// public read RPC `get_public_list`, which gates on type=null (regular
// user list) and isn't system / shared-inbox. Drafts of system lists,
// challenges, and the shared inbox itself return null silently — the
// recipient sees a clean "not available" state instead of the data.
//
// Recipient surfaces:
//   - Loading / error / loaded states
//   - Read-only grid of items (listing-backed + manual entries)
//   - Two CTAs: "Save a copy" (auth-required; creates a new list owned
//     by the recipient with the same items) and "Just browse" (clears
//     URL, drops the receiver, keeps the user on the listings tab).
//
// Cards render through a slim inline tile here rather than the full
// Card component — recipient items are read-only, so we don't need the
// heart / share / "..." menu wiring. This stays light AND avoids the
// prop-drill needed to make full Cards behave on a foreign-data list.

export function ListReceiver({
  user,
  isAuthConfigured,
  signInWithGoogle,
  collectionsApi,
  // Main feed items — joined against `listingId` to render
  // listing-backed rows. Manual rows carry their snapshot inline.
  items: feedItems,
  primaryCurrency,
  // Mirror active state up so the shell hides browse chrome.
  setListShareActive,
  // Navigation hooks for the "Just browse" + post-save flow.
  setTab,
  // App.js increments this when the user explicitly navigates away
  // via main nav — clear our intent state when it bumps.
  resetTick,
}) {
  const [listId, setListId] = useState(null);
  // Token-based invite acceptance (List Sharing v2.1). When the
  // owner uses "Invite & share link", the URL carries `?invite=<id>`
  // alongside `?list=<id>&shared=1`. The invite token is the secret
  // that unlocks accept regardless of email match — solves the case
  // where the invitee's Google account differs from what the owner
  // typed.
  const [inviteToken, setInviteToken] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedCopyId, setSavedCopyId] = useState(null);
  // List Sharing v2 / slice 3 + 2.1: when the invitee opens the share
  // link, we surface an inline "Accept invite" CTA. matchedInvite is
  // populated either by token lookup (URL invite=) OR by email-matched
  // pending-invites lookup (legacy path for links without token).
  const [matchedInvite, setMatchedInvite] = useState(null);
  const [acceptedInviteId, setAcceptedInviteId] = useState(null);

  // Parse URL on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("list") && params.get("shared") === "1") {
        setListId(params.get("list"));
        const tok = params.get("invite");
        if (tok) setInviteToken(tok);
      }
    } catch (e) {
      console.warn("list URL parse failed", e);
    }
  }, []);

  // Mirror to parent for shell chrome gating.
  useEffect(() => {
    if (typeof setListShareActive === "function") {
      setListShareActive(!!listId);
    }
  }, [listId, setListShareActive]);

  // External escape signal — clear intent on bump.
  useEffect(() => {
    if (resetTick && resetTick > 0) {
      setListId(null);
      setInviteToken(null);
      setData(null);
      setError("");
      setSavedCopyId(null);
      setMatchedInvite(null);
      setAcceptedInviteId(null);
    }
  }, [resetTick]);

  // Fetch the public-read list. Anonymous-safe (RPC's anon grant).
  useEffect(() => {
    if (!listId) return undefined;
    if (!supabase) { setError("Supabase not configured."); return undefined; }
    let cancelled = false;
    supabase.rpc("get_public_list", { list_id: listId })
      .then(({ data: rpcData, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) { setError(rpcError.message || "Failed to load."); return; }
        if (!rpcData) {
          setError("This list isn't available — the link might be wrong, or the list isn't shareable.");
          return;
        }
        setData(rpcData);
      });
    return () => { cancelled = true; };
  }, [listId]);

  // Receiver-side invite resolution. Two paths:
  //
  //   1. Token path (preferred, post-2026-05-08 share links):
  //      `?invite=<id>` is in the URL. Look up the invite directly
  //      and surface the accept CTA without requiring email match.
  //
  //   2. Email-match path (legacy links + a fallback): no token in
  //      URL; check the signed-in user's pending invites and look
  //      for one matching the URL list_id.
  //
  // Both paths populate matchedInvite with a normalised row shape:
  //   { invite_id, collection_id, role, inviter_email, inviter_name }
  useEffect(() => {
    if (!listId) { setMatchedInvite(null); return undefined; }
    let cancelled = false;
    if (inviteToken && collectionsApi?.fetchInviteByToken) {
      collectionsApi.fetchInviteByToken(inviteToken).then(({ invite, error: invErr }) => {
        if (cancelled) return;
        if (invErr || !invite) { setMatchedInvite(null); return; }
        // Token resolved but invite is for a different list — ignore
        // (stale URL) so we don't surface a misleading CTA.
        if (invite.collection_id !== listId) { setMatchedInvite(null); return; }
        if (invite.status !== 'pending') { setMatchedInvite(null); return; }
        setMatchedInvite({
          invite_id: invite.invite_id,
          collection_id: invite.collection_id,
          role: invite.role,
          inviter_email: invite.inviter_email,
          inviter_name: invite.inviter_name,
          // flag so onAcceptInvite knows to call accept_invite_by_token
          // instead of the email-gated accept_invite.
          via_token: true,
        });
      });
      return () => { cancelled = true; };
    }
    // Legacy email-match path: requires sign-in to find pending invites.
    if (!user || !collectionsApi?.fetchPendingInvitesForMe) {
      setMatchedInvite(null);
      return undefined;
    }
    collectionsApi.fetchPendingInvitesForMe().then(({ rows }) => {
      if (cancelled) return;
      const match = (rows || []).find(r => r.collection_id === listId) || null;
      setMatchedInvite(match);
    });
    return () => { cancelled = true; };
  }, [listId, inviteToken, user, collectionsApi]);

  const clearIntent = useCallback(() => {
    setListId(null);
    setInviteToken(null);
    setData(null);
    setError("");
    setSavedCopyId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("list");
      url.searchParams.delete("shared");
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const onJustBrowse = useCallback(() => {
    clearIntent();
    if (typeof setTab === "function") setTab("listings");
  }, [clearIntent, setTab]);

  // Accept the matched invite, then drop the user into Saved > Lists
  // drilled into the (now-shared) list. RLS expansion from slice 1
  // means the list shows up in their normal Lists surface immediately
  // after accept. Token-path invites use accept_invite_by_token (no
  // email-match gate); legacy email-path invites use accept_invite.
  const onAcceptInvite = useCallback(async () => {
    if (!matchedInvite || !collectionsApi) return;
    if (!user) return; // shouldn't be possible — CTA gated on user
    const fn = matchedInvite.via_token
      ? collectionsApi.acceptInviteByToken
      : collectionsApi.acceptInvite;
    if (!fn) return;
    setBusy(true);
    setError("");
    const res = await fn(matchedInvite.invite_id);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setAcceptedInviteId(matchedInvite.invite_id);
    setMatchedInvite(null);
  }, [matchedInvite, collectionsApi, user]);

  const onOpenSharedList = useCallback(() => {
    if (!listId) return;
    clearIntent();
    // Navigate to Saved > Lists with the col drill-in. App.js +
    // CollectionsTab handle the URL → state derivation.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "watchlist");
      url.searchParams.set("sub", "lists");
      url.searchParams.set("col", listId);
      window.history.pushState({}, "", url.toString());
      // Force the receivers to clear + the shells to re-derive.
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {}
  }, [listId, clearIntent]);

  const onDeclineInvite = useCallback(async () => {
    if (!matchedInvite || !collectionsApi?.declineInvite) return;
    setBusy(true);
    setError("");
    const res = await collectionsApi.declineInvite(matchedInvite.invite_id);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setMatchedInvite(null);
  }, [matchedInvite, collectionsApi]);

  // Save a copy — creates a new list owned by the recipient with the
  // same items. Listing-backed rows are looked up against the public
  // feed; manual entries are recreated through addManualItem.
  const onSaveCopy = useCallback(async () => {
    if (!user) return;
    if (!data || !collectionsApi) return;
    setBusy(true);
    setError("");
    try {
      const newName = `${data.name} (shared with me)`;
      const created = await collectionsApi.createCollection(newName);
      if (created?.error || !created?.id) {
        setError("Could not save copy: " + (created?.error || "unknown"));
        setBusy(false);
        return;
      }
      const newId = created.id;
      const feedById = new Map((feedItems || []).map(fi => [fi.id, fi]));
      for (const it of data.items || []) {
        if (it.isManual) {
          if (collectionsApi.addManualItem) {
            await collectionsApi.addManualItem(newId, {
              imageUrl:      it.manualImageUrl,
              brand:         it.manualBrand,
              model:         it.manualModel,
              reference:     it.manualReference,
              material:      it.manualMaterial,
              pricePaid:     it.manualPricePaid,
              priceCurrency: it.manualPriceCurrency,
              soldPrice:     it.manualSoldPrice,
              soldDate:      it.manualSoldDate,
              comments:      it.manualComments,
              sourceUrl:     it.manualSourceUrl,
            });
          }
        } else if (it.listingId) {
          const listing = feedById.get(it.listingId);
          if (listing && collectionsApi.addItemToCollection) {
            await collectionsApi.addItemToCollection(newId, listing);
          }
        }
      }
      setSavedCopyId(newId);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [user, data, collectionsApi, feedItems]);

  if (!listId) return null;

  // ── Render branches ──────────────────────────────────────────

  // Loading.
  if (!data && !error) {
    return (
      <div style={landingPaneStyle()}>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>Loading list…</p>
      </div>
    );
  }
  // Error.
  if (error) {
    return (
      <div style={landingPaneStyle()}>
        <h2 style={headerStyle()}>List unavailable</h2>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 18 }}>
          {error}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onJustBrowse} style={primaryBtnStyle}>Browse Watchlist</button>
        </div>
      </div>
    );
  }

  // Saved-copy success state.
  if (savedCopyId) {
    return (
      <div style={landingPaneStyle()}>
        <h2 style={headerStyle()}>Saved to your collections</h2>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 18 }}>
          A copy of <strong style={{ color: "var(--text1)" }}>{data.name}</strong> has been
          added to your lists. Open it in Saved &gt; Lists to view, share, or edit.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => { clearIntent(); if (typeof setTab === "function") setTab("watchlist"); }}
            style={primaryBtnStyle}>Open my lists →</button>
          <button onClick={onJustBrowse} style={secondaryBtnStyle}>Keep browsing</button>
        </div>
      </div>
    );
  }

  // Loaded — render items + CTAs.
  const items = data.items || [];
  const itemCount = items.length;
  return (
    <div style={landingPaneStyle()}>
      <div style={{ marginBottom: 6, fontSize: 12, color: "var(--text3)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
        {acceptedInviteId ? "Joined list" : matchedInvite ? "Invite to join" : "Shared list"}
      </div>
      <h2 style={headerStyle()}>{data.name}</h2>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
        {itemCount === 0
          ? "This list is empty."
          : `${itemCount} watch${itemCount === 1 ? "" : "es"}`}
      </p>

      {/* List Sharing v2 / slice 3 — accept-invite banner. Surfaces
          when the signed-in user has a pending invite for THIS list.
          Replaces the "Save a copy" CTA: accept gives them the
          owner's actual list (not a snapshot), with the role the
          owner picked. */}
      {matchedInvite && !acceptedInviteId && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          border: "1px solid var(--brand)",
          background: "rgba(24,95,165,0.08)",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: "var(--text1)", marginBottom: 8, lineHeight: 1.5 }}>
            <strong>{matchedInvite.inviter_name || matchedInvite.inviter_email}</strong> invited
            you to collaborate on this list as a <strong>{matchedInvite.role}</strong>.
            Accept to add it to your Saved &gt; Lists, where you can see new additions live.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {user ? (
              <>
                <button onClick={onAcceptInvite} disabled={busy} style={primaryBtnStyle}>
                  {busy ? "Joining…" : "Accept invite"}
                </button>
                <button onClick={onDeclineInvite} disabled={busy} style={secondaryBtnStyle}>
                  Decline
                </button>
              </>
            ) : isAuthConfigured ? (
              <button onClick={signInWithGoogle} style={primaryBtnStyle}>
                Sign in to join
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Post-accept success — drop them straight into the shared list. */}
      {acceptedInviteId && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          border: "1px solid var(--brand)",
          background: "rgba(24,95,165,0.08)",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: "var(--text1)", marginBottom: 8 }}>
            You're in. The list now shows up under your Saved &gt; Lists.
          </div>
          <button onClick={onOpenSharedList} style={primaryBtnStyle}>
            Open the shared list →
          </button>
        </div>
      )}

      {/* CTAs above the items so the user doesn't have to scroll past
          a long list to find them. Mirrors the sticky-Finish pattern
          on ChallengeFlow's picking stage. The "Save a copy" path
          stays available even with a matched invite — some recipients
          will prefer their own copy (e.g., wanting to make solo edits
          without affecting the shared set). */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {user && !acceptedInviteId && (
          <button onClick={onSaveCopy} disabled={busy}
            style={matchedInvite ? secondaryBtnStyle : primaryBtnStyle}>
            {busy ? "Saving…" : "Save a copy to my lists"}
          </button>
        )}
        {!user && isAuthConfigured && (
          <button onClick={signInWithGoogle} style={primaryBtnStyle}>
            Sign in to save or accept an invite
          </button>
        )}
        <button onClick={onJustBrowse} style={secondaryBtnStyle}>
          Just browse
        </button>
      </div>

      {/* Items grid — slim inline tiles. Recipient view is read-only. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 10,
      }}>
        {items.map(it => (
          <ItemTile key={it.rowId} item={it} feedById={feedItems} primaryCurrency={primaryCurrency} />
        ))}
      </div>
    </div>
  );
}

// Slim read-only tile. Joins listing-backed rows against the feed by
// listingId; falls back to manual snapshot for is_manual rows.
function ItemTile({ item, feedById, primaryCurrency }) {
  // feedById is the array of mainFeedItems; build a quick lookup.
  // (Building per-tile is wasteful but cheap at typical list size.)
  const listing = !item.isManual && item.listingId
    ? (feedById || []).find(fi => fi.id === item.listingId)
    : null;
  const title = item.isManual
    ? [item.manualBrand, item.manualModel].filter(Boolean).join(" ").trim() || "Untitled"
    : (listing
        ? `${listing.brand || ""}${listing.ref ? " · " + listing.ref : ""}`.trim() || listing.title || "Untitled"
        : "Listing not in current feed");
  const img = item.isManual
    ? item.manualImageUrl
    : (listing ? imgSrc(listing.img) : null);
  const priceUSD = item.savedPriceUSD || item.savedPrice || (listing ? listing.priceUSD : null);
  const priceCurrency = item.savedCurrency || (listing ? listing.currency : null);
  const priceText = item.isManual && item.manualPricePaid
    ? fmt(item.manualPricePaid, item.manualPriceCurrency || "USD")
    : (priceUSD ? fmtUSD(priceUSD) : "");
  const url = !item.isManual && listing ? listing.url : (item.manualSourceUrl || null);

  return (
    <a href={url || undefined} target={url ? "_blank" : undefined} rel="noopener noreferrer"
      style={{
        display: "block", textDecoration: "none", color: "inherit",
        border: "0.5px solid var(--border)", borderRadius: 10,
        background: "var(--card-bg)", overflow: "hidden",
        cursor: url ? "pointer" : "default",
      }}>
      <div style={{
        width: "100%", aspectRatio: "1/1", background: "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {img ? (
          <img src={img} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 28, color: "var(--text3)" }}>⌚</span>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: "var(--text1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 2,
        }}>{title}</div>
        {priceText && (
          <div style={{ fontSize: 12, color: "var(--text2)" }}>{priceText}</div>
        )}
      </div>
    </a>
  );
}

// ── Shared style helpers ──────────────────────────────────────

function landingPaneStyle() {
  return {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 14px 110px",
  };
}

function headerStyle() {
  return {
    fontSize: 22, fontWeight: 700, color: "var(--text1)",
    margin: "0 0 4px", letterSpacing: "-0.3px",
  };
}

// primaryBtnStyle now imported from styles.js as signInButton.
// Local secondaryBtnStyle keeps the same geometry (10px 18px / radius 10)
// for parity with the primary so the two read as a paired CTA group.
const secondaryBtnStyle = {
  border: "0.5px solid var(--border)", background: "transparent",
  color: "var(--text2)",
  padding: "10px 18px", borderRadius: 10,
  cursor: "pointer", fontFamily: "inherit", fontSize: 14,
};
