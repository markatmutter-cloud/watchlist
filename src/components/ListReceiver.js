import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { fmt, fmtUSD, imgSrc } from "../utils";

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
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedCopyId, setSavedCopyId] = useState(null);

  // Parse URL on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("list") && params.get("shared") === "1") {
        setListId(params.get("list"));
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
      setData(null);
      setError("");
      setSavedCopyId(null);
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

  const clearIntent = useCallback(() => {
    setListId(null);
    setData(null);
    setError("");
    setSavedCopyId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("list");
      url.searchParams.delete("shared");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const onJustBrowse = useCallback(() => {
    clearIntent();
    if (typeof setTab === "function") setTab("listings");
  }, [clearIntent, setTab]);

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
        Shared list
      </div>
      <h2 style={headerStyle()}>{data.name}</h2>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
        {itemCount === 0
          ? "This list is empty."
          : `${itemCount} watch${itemCount === 1 ? "" : "es"}`}
      </p>

      {/* CTAs above the items so the user doesn't have to scroll past
          a long list to find them. Mirrors the sticky-Finish pattern
          on ChallengeFlow's picking stage. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {user && (
          <button onClick={onSaveCopy} disabled={busy} style={primaryBtnStyle}>
            {busy ? "Saving…" : "Save a copy to my lists"}
          </button>
        )}
        {!user && isAuthConfigured && (
          <button onClick={signInWithGoogle} style={primaryBtnStyle}>
            Sign in to save a copy
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

const primaryBtnStyle = {
  border: "none", background: "#185FA5", color: "#fff",
  padding: "10px 18px", borderRadius: 10,
  cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 500,
};

const secondaryBtnStyle = {
  border: "0.5px solid var(--border)", background: "transparent",
  color: "var(--text2)",
  padding: "10px 18px", borderRadius: 10,
  cursor: "pointer", fontFamily: "inherit", fontSize: 14,
};
