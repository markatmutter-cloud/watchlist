import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "./Card";
import { ShareBanner } from "./ShareBanner";

// Self-contained share-receive surface. All hooks live INSIDE this
// component — App.js mounts it unconditionally and its hook count
// stays unchanged. v2 (commit e8521a2, reverted as 4734c28) added 3
// hooks to App.js's already-large hook list and tripped React error
// #310 ("rendered more hooks than during the previous render") in
// production. Isolation here makes that whole class of bug
// impossible: ShareReceiver's hooks only count against
// ShareReceiver's instance.
//
// What this component does:
//   - Parses ?listing=<id>&shared=1 on mount via useEffect.
//   - Looks up the shared item against props.items (gated on
//     items being a non-empty array).
//   - Renders ShareBanner + a Card for the shared listing above
//     whatever the parent is showing.
//   - Save = toggleWatchlist + addToSharedInbox; Dismiss =
//     addToSharedInbox only. Anonymous = no DB writes, optional
//     sign-in CTA.
//   - Clears state + rewrites URL after action so refresh doesn't
//     re-trigger.
//
// Returns null when no share intent — zero render cost in the
// common path.

export function ShareReceiver({
  items,
  user,
  watchlist,
  toggleWatchlist,
  addToSharedInbox,
  handleWish,
  handleShare,
  isAuthConfigured,
  signInWithGoogle,
  primaryCurrency,
}) {
  const [shareIntent, setShareIntent] = useState(null);
  const [busy, setBusy] = useState(false);

  // Parse URL on mount. useEffect (not useState lazy init) so the
  // first render is always shareIntent=null — no fights with
  // strict-mode double-mount or pre-mount weirdness.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("shared") !== "1") return;
      const id = params.get("listing");
      if (id) setShareIntent({ id });
    } catch (e) {
      console.warn("share URL parse failed", e);
    }
  }, []);

  const sharedItem = useMemo(() => {
    if (!shareIntent || !shareIntent.id) return null;
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.find(i => i && i.id === shareIntent.id) || null;
  }, [shareIntent, items]);

  const clearIntent = useCallback(() => {
    setShareIntent(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("listing");
      url.searchParams.delete("shared");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const onSave = useCallback(async () => {
    if (!sharedItem || !user) { clearIntent(); return; }
    setBusy(true);
    try {
      if (watchlist && !watchlist[sharedItem.id] && typeof toggleWatchlist === "function") {
        toggleWatchlist(sharedItem);
      }
      if (typeof addToSharedInbox === "function") {
        await addToSharedInbox(sharedItem);
      }
    } catch (e) {
      console.warn("share save failed", e);
    }
    setBusy(false);
    clearIntent();
  }, [sharedItem, user, watchlist, toggleWatchlist, addToSharedInbox, clearIntent]);

  const onDismiss = useCallback(async () => {
    if (sharedItem && user) {
      setBusy(true);
      try {
        if (typeof addToSharedInbox === "function") {
          await addToSharedInbox(sharedItem);
        }
      } catch (e) {
        console.warn("share dismiss failed", e);
      }
      setBusy(false);
    }
    clearIntent();
  }, [sharedItem, user, addToSharedInbox, clearIntent]);

  // Early-out: no banner until items are loaded. We don't render
  // anything until items.length > 0 so the lookup memo above always
  // returns a real value (or null because the id legitimately doesn't
  // match), never null-because-still-loading.
  if (!shareIntent) return null;
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div style={{ padding: "12px 16px 0" }}>
      <ShareBanner
        signedIn={!!user}
        busy={busy}
        onSave={onSave}
        onDismiss={onDismiss}
        onSignIn={!user && isAuthConfigured ? signInWithGoogle : undefined}
      />
      {sharedItem ? (
        <div style={{
          maxWidth: 320, marginBottom: 8,
          borderRadius: 10, overflow: "hidden",
          border: "0.5px solid var(--border)",
        }}>
          <Card
            item={sharedItem}
            wished={!!(watchlist && watchlist[sharedItem.id])}
            onWish={handleWish}
            compact={false}
            onShare={handleShare}
            primaryCurrency={primaryCurrency}
          />
        </div>
      ) : (
        <div style={{
          padding: "20px 16px", borderRadius: 10,
          border: "0.5px solid var(--border)", background: "var(--card-bg)",
          fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8,
        }}>
          The shared listing isn't in the feed right now — the dealer
          may have removed it, or it scrolled off the active list.
        </div>
      )}
    </div>
  );
}
