import React, { useState, useEffect, useCallback } from "react";
import { sharedParam } from "../receiveIntent";
import { supabase } from "../supabase";
import { imgSrc } from "../utils";
import { SharedReceiveFrame, ShareTitle, ShareSub, ShareEmpty } from "./SharedReceiveFrame";

// List-share receive flow — reskinned onto SharedReceiveFrame (Mark 2026-06-02)
// so it shares the common chrome/language/layout with every other shared type.
// All hooks live INSIDE this component; App.js only mirrors a one-bit
// `listShareActive` flag back up so the shell hides browse chrome.
//
// TWO-MODE model (Mark locked 2026-06-02): a shared list has two distinct
// intents, and the destination follows the mode —
//   • Send a copy   — a PLAIN link (`?list=<id>&shared=1`). Recipient takes
//     their OWN independent, editable copy → lands in *Your lists*.
//   • Collaborate    — a link with `?invite=<token>`. Recipient JOINS the
//     in-sync list → lands in *Shared with you*.
// The invite token is the proxy for the mode today; the sender-side
// "Send a copy vs Collaborate" picker is the planned follow-up PR that makes
// the choice explicit (it just sets/omits the token).
//
// Instead of a read-only grid, the recipient sees a list-cover CARD preview
// (a collage of the first few covers) + the ONE clearly-labelled outcome for
// the mode (a collaborate link also offers "Save a copy" as the alternate
// outcome). Save/Join always land you INSIDE your Lists — never a separate
// read-only surface.

export function ListReceiver({
  user,
  isAuthConfigured,
  signInWithGoogle,
  collectionsApi,
  // Main feed items — joined against `listingId` to resolve cover images.
  items: feedItems,
  // Mirror active state up so the shell hides browse chrome.
  setListShareActive,
  // Navigation hooks for the "Just browse" + post-action flow.
  setTab,
  // App.js increments this when the user explicitly navigates away
  // via main nav — clear our intent state when it bumps.
  resetTick,
}) {
  const [listId, setListId] = useState(() => sharedParam("list"));
  // Token-based invite acceptance (List Sharing v2.1). When the owner shares a
  // COLLABORATE link, the URL carries `?invite=<id>` — the secret that unlocks
  // accept regardless of email match (handles a different Google account).
  const [inviteToken, setInviteToken] = useState(null);
  const [fromName, setFromName] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedCopyId, setSavedCopyId] = useState(null);
  // Populated either by token lookup (URL invite=) OR by email-matched
  // pending-invites lookup (legacy links without a token).
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
        const from = params.get("from");
        if (from) setFromName(from);
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
      setFromName("");
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
          setError("This list isn't available. The link might be wrong, or the list isn't shareable.");
          return;
        }
        setData(rpcData);
      });
    return () => { cancelled = true; };
  }, [listId]);

  // Receiver-side invite resolution. Token path (preferred) or email-match
  // (legacy). Populates matchedInvite with a normalised row shape:
  //   { invite_id, collection_id, role, inviter_email, inviter_name, via_token }
  useEffect(() => {
    if (!listId) { setMatchedInvite(null); return undefined; }
    let cancelled = false;
    if (inviteToken && collectionsApi?.fetchInviteByToken) {
      collectionsApi.fetchInviteByToken(inviteToken).then(({ invite, error: invErr }) => {
        if (cancelled) return;
        if (invErr || !invite) { setMatchedInvite(null); return; }
        // Token resolved but invite is for a different list — ignore (stale URL).
        if (invite.collection_id !== listId) { setMatchedInvite(null); return; }
        if (invite.status !== 'pending') { setMatchedInvite(null); return; }
        setMatchedInvite({
          invite_id: invite.invite_id,
          collection_id: invite.collection_id,
          role: invite.role,
          inviter_email: invite.inviter_email,
          inviter_name: invite.inviter_name,
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
    setFromName("");
    setData(null);
    setError("");
    setSavedCopyId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("list");
      url.searchParams.delete("shared");
      url.searchParams.delete("invite");
      url.searchParams.delete("from");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const onJustBrowse = useCallback(() => {
    clearIntent();
    if (typeof setTab === "function") setTab("listings");
  }, [clearIntent, setTab]);

  // Navigate INTO the user's Lists, drilled into a specific list — the
  // single destination for both modes (copy → the new copy; collaborate →
  // the now-shared list). RLS expansion means a joined list shows up under
  // the recipient's normal Lists surface immediately.
  const openListInLists = useCallback((id) => {
    if (!id) return;
    clearIntent();
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "watchlist");
      url.searchParams.set("sub", "lists");
      url.searchParams.set("col", id);
      window.history.pushState({}, "", url.toString());
      // Force the receivers to clear + the shells to re-derive.
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {}
  }, [clearIntent]);

  // COLLABORATE: accept the matched invite → the synced list joins
  // *Shared with you*. Token-path invites use accept_invite_by_token (no
  // email-match gate); legacy email-path invites use accept_invite.
  const onAcceptInvite = useCallback(async () => {
    if (!matchedInvite || !collectionsApi) return;
    if (!user) return; // CTA gated on user
    const fn = matchedInvite.via_token
      ? collectionsApi.acceptInviteByToken
      : collectionsApi.acceptInvite;
    if (!fn) return;
    setBusy(true);
    setError("");
    const res = await fn(matchedInvite.invite_id);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setAcceptedInviteId(matchedInvite.invite_id);
    setMatchedInvite(null);
  }, [matchedInvite, collectionsApi, user]);

  // SEND A COPY: create a new list owned by the recipient with the same
  // items → it lands in *Your lists*, fully editable. Listing-backed rows are
  // looked up against the public feed; manual entries recreated via addManualItem.
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

  const sender = (fromName || matchedInvite?.inviter_name || matchedInvite?.inviter_email || "").trim();

  // ── Loading (transient) ──────────────────────────────────────
  if (!data && !error) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 16px 110px" }}>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>Pulling the list…</p>
      </div>
    );
  }

  // ── Error — still no dead end (render through the frame) ──────
  if (error) {
    return (
      <SharedReceiveFrame
        sender={sender}
        typeLabel="list"
        hero={unavailableHero("This list isn't available")}
        identity={
          <>
            <ShareTitle>This list isn't available</ShareTitle>
            <ShareSub>{error}</ShareSub>
          </>
        }
        primaryCTA={{ label: "Browse Watchlist →", onClick: onJustBrowse }}
        signedIn={!!user}
      />
    );
  }

  const items = data.items || [];
  const itemCount = items.length;
  const covers = coverImages(items, feedItems);
  const hero = coverHero(covers);

  // ── Saved-a-copy success → into Your lists ───────────────────
  if (savedCopyId) {
    return (
      <SharedReceiveFrame
        sender={sender}
        typeLabel="list"
        hero={hero}
        identity={
          <>
            <ShareTitle>Saved to your lists</ShareTitle>
            <ShareSub>
              A copy of <strong style={{ color: "var(--text1)" }}>{data.name}</strong> is now in
              your lists. Open it to browse, edit, or share.
            </ShareSub>
          </>
        }
        primaryCTA={{ label: "Open my lists →", onClick: () => openListInLists(savedCopyId) }}
        signedIn={!!user}
        navCues={[{ label: "Keep browsing", onClick: onJustBrowse }]}
      />
    );
  }

  // ── Joined a collaboration → into Shared with you ────────────
  if (acceptedInviteId) {
    return (
      <SharedReceiveFrame
        sender={sender}
        typeLabel="list"
        hero={hero}
        identity={
          <>
            <ShareTitle>You're in</ShareTitle>
            <ShareSub>
              <strong style={{ color: "var(--text1)" }}>{data.name}</strong> now lives under
              Lists ▸ Shared with you. Anything either of you adds stays in sync.
            </ShareSub>
          </>
        }
        primaryCTA={{ label: "Open the shared list →", onClick: () => openListInLists(listId) }}
        signedIn={!!user}
        navCues={[{ label: "Keep browsing", onClick: onJustBrowse }]}
      />
    );
  }

  // ── Loaded — mode-aware, clearly-labelled outcome(s) ─────────
  // Collaborate mode = a pending invite is matched (the link carried a token).
  // Otherwise it's a Send-a-copy link.
  const isCollab = !!matchedInvite;

  const identity = (
    <>
      <ShareTitle>{data.name}</ShareTitle>
      <ShareSub>
        {itemCount === 0
          ? "Nothing in this list yet."
          : `${itemCount} watch${itemCount === 1 ? "" : "es"}`}
      </ShareSub>
      {/* What a list IS + what you can do — the recipient's first impression
          used to explain nothing (P-23, Mark 2026-06-03). */}
      <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 8, lineHeight: 1.55 }}>
        A list on Watchlist: watches {sender ? `${sender} collected` : "someone collected"} from
        dealers and auctions. Browse it below{user ? ", or save your own copy to keep and edit" : ""}.
      </div>
      {isCollab && (
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 8, lineHeight: 1.5 }}>
          Invited to <strong style={{ color: "var(--text1)" }}>collaborate</strong> as a{" "}
          {matchedInvite.role}, and you'll both add and remove watches in one synced list.
        </div>
      )}
    </>
  );

  // Primary verb + optional secondary outcome, per mode.
  let primaryCTA;
  let extraActions = [];
  if (isCollab) {
    primaryCTA = user
      ? { label: busy ? "Joining…" : "Collaborate", onClick: onAcceptInvite }
      : (isAuthConfigured && signInWithGoogle
          ? { label: "Collaborate (sign in)", onClick: signInWithGoogle }
          : null);
    // The alternate outcome stays clearly labelled: take your own copy instead.
    if (user) extraActions = [{ label: busy ? "Saving…" : "Save a copy instead", onClick: onSaveCopy }];
  } else {
    primaryCTA = user
      ? { label: busy ? "Saving…" : "Save a copy", onClick: onSaveCopy }
      : (isAuthConfigured && signInWithGoogle
          ? { label: "Sign in to save a copy", onClick: signInWithGoogle }
          : null);
  }

  return (
    <>
      <SharedReceiveFrame
        sender={sender}
        typeLabel="list"
        hero={hero}
        identity={identity}
        primaryCTA={primaryCTA}
        signedIn={!!user}
        busy={busy}
        extraActions={extraActions}
        navCues={[{ label: "Just browse", onClick: onJustBrowse }]}
      />
      {/* The list's actual CONTENT, viewable in place (P-23 — "shared to view
          only but there is no view"). Read-only tiles off the snapshot/feed;
          saving/joining is what unlocks the full interactive list. Negative
          top margin tightens against the frame's launcher-clearance padding. */}
      {itemCount > 0 && (
        <div style={{ maxWidth: 1100, margin: "-72px auto 0", padding: "0 16px 110px", width: "100%" }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--text2)", margin: "0 0 12px",
          }}>In this list</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
            {items.map((it) => {
              const img = itemImage(it, feedItems);
              const title = itemTitle(it, feedItems);
              return (
                <div key={it.rowId || it.listingId}>
                  <div style={{ width: "100%", aspectRatio: "1 / 1", background: "var(--surface)", overflow: "hidden", borderRadius: 6 }}>
                    {img && (
                      <img src={img} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 500, color: "var(--text1)", marginTop: 6, lineHeight: 1.35,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>{title}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Hero builders ─────────────────────────────────────────────

// Up to four cover images for the list-cover collage. Listing-backed rows
// resolve against the live feed, FALLING BACK to the saved listing_snapshot
// (returned by get_public_list since 2026-06-03) — before that fallback, any
// item no longer in the live feed rendered the 🗂 placeholder (P-23).
function itemImage(it, feed) {
  if (!it) return null;
  if (it.isManual) return it.manualImageUrl || null;
  const live = it.listingId ? (feed || []).find(fi => fi.id === it.listingId) : null;
  if (live && live.img) return imgSrc(live.img);
  const snap = it.snapshot || {};
  return snap.img ? imgSrc(snap.img) : null;
}

function itemTitle(it, feed) {
  if (!it) return "Watch";
  if (it.isManual) {
    return [it.manualBrand, it.manualModel, it.manualReference].filter(Boolean).join(" ") || "Watch";
  }
  const live = it.listingId ? (feed || []).find(fi => fi.id === it.listingId) : null;
  const snap = it.snapshot || {};
  return (live && (live.ref || live.title)) || snap.ref || snap.title || "Watch";
}

function coverImages(items, feedItems) {
  const out = [];
  for (const it of items || []) {
    if (out.length >= 4) break;
    const img = itemImage(it, feedItems);
    if (img) out.push(img);
  }
  return out;
}

// A list "cover" — one image fills, 2–4 tile into a collage, none → placeholder.
function coverHero(covers) {
  if (!covers || covers.length === 0) {
    return (
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 8,
        color: "var(--text3)", fontSize: 13,
      }}>
        <span style={{ fontSize: 30 }}>🗂</span>
        <span>List preview</span>
      </div>
    );
  }
  if (covers.length === 1) {
    return (
      <img src={covers[0]} alt="" loading="eager"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
    );
  }
  return (
    <div style={{
      position: "absolute", inset: 0, display: "grid", gap: 2,
      gridTemplateColumns: "repeat(2, 1fr)",
      gridAutoRows: covers.length <= 2 ? "100%" : "50%",
    }}>
      {covers.slice(0, 4).map((src, i) => (
        <div key={i} style={{ overflow: "hidden", background: "var(--surface)" }}>
          <img src={src} alt="" loading="eager"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      ))}
    </div>
  );
}

function unavailableHero(label) {
  return (
    <ShareEmpty><span>{label}</span></ShareEmpty>
  );
}

