import React, { useState, useEffect, useMemo, useCallback } from "react";
import { fmt, imgSrc, priceIn, FX_RATES_USD_PER, CURRENCY_SYM } from "../utils";

// Self-contained share-receive surface. All hooks live INSIDE this
// component — App.js mounts it unconditionally and its hook count
// stays unchanged. v2 (commit e8521a2, reverted as 4734c28) added 3
// hooks to App.js's already-large hook list and tripped React error
// #310 ("rendered more hooks than during the previous render") in
// production. Isolation here makes that whole class of bug
// impossible: ShareReceiver's hooks only count against
// ShareReceiver's instance.
//
// 2026-05-06 redesign: when share intent is active, this component
// renders a FULL-WIDTH FOCUSED LANDING SURFACE rather than a small
// banner+thumbnail above the regular feed. Mark's framing: this is
// the first-impression for first-time recipients who follow a share
// link, and it needs to feel intentional, not like the listing got
// dropped onto an unrelated browse page. App.js mirrors the active
// state via setShareActive so the shell can hide the regular tab
// content while the landing surface is up.
//
// Layout:
//   Desktop  → two-column inside the focused card: left = image
//              (full-bleed square), right = title/brand/ref/price/
//              dealer + Save/Dismiss + onboarding text.
//   Mobile   → stacked: image, then details, then CTAs.
// Below the main card, three anchor CTAs orient first-time users:
// "Browse all listings", "Go to your list", "About Watchlist".
//
// Returns null when no share intent — zero render cost in the
// common path.

export function ShareReceiver({
  items,
  user,
  watchlist,
  toggleWatchlist,
  addToSharedInbox,
  isAuthConfigured,
  signInWithGoogle,
  primaryCurrency,
  // App.js mirrors share-active state so the shell can swap the
  // regular feed out for the focused landing surface. Without this,
  // the share card renders alongside the feed which Mark flagged as
  // unintentional-feeling.
  setShareActive,
  // Telemetry (Epic 8). Optional. Click-on-shared-listing is the
  // engagement signal worth capturing here; view tracking is skipped
  // because the receiver is a single-card banner (not a feed scroll).
  onClickListing,
  // Navigation hooks for the orientation CTAs at the bottom.
  setTab,
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

  // Mirror to parent. ShareReceiver is the source of truth for
  // share-active state; the shell needs to know to hide the regular
  // feed underneath.
  useEffect(() => {
    if (typeof setShareActive === "function") {
      setShareActive(!!shareIntent);
    }
  }, [shareIntent, setShareActive]);

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

  // Early-out: no surface until items are loaded. We don't render
  // anything until items.length > 0 so the lookup memo above always
  // returns a real value (or null because the id legitimately doesn't
  // match), never null-because-still-loading.
  if (!shareIntent) return null;
  if (!Array.isArray(items) || items.length === 0) return null;

  const isAlreadySaved = sharedItem && watchlist && !!watchlist[sharedItem.id];

  // Price formatting mirrors Card's logic — show user's primary
  // currency primary, native price secondary if it differs.
  const fmtPriceLine = (item) => {
    if (!item || !item.priceUSD || !item.price) return "";
    const native = item.currency || "USD";
    const primary = primaryCurrency || "USD";
    const primaryAmt = primary === "USD"
      ? item.priceUSD
      : priceIn(item.priceUSD, "USD", primary, FX_RATES_USD_PER);
    if (!primaryAmt) return fmt(item.price, native);
    if (native === primary) return fmt(item.price, native);
    return `${fmt(primaryAmt, primary)} · ${fmt(item.price, native)}`;
  };

  const onClickAnchor = (tab) => {
    clearIntent();
    if (typeof setTab === "function") setTab(tab);
  };

  return (
    <div style={{
      // Take over the parent content area. Bottom padding sized to
      // clear the mobile bottom tab bar (~80px tall). maxWidth bumped
      // 1320 → 1600 so on wider screens the focused card actually
      // uses the available room instead of sitting in a centred well.
      padding: "16px 16px 110px",
      maxWidth: 1600,
      margin: "0 auto",
      width: "100%",
    }}>
      {/* Compact onboarding header — h1 alone carries the context.
          Earlier iterations had a "Shared with you" pill chip beside
          the heading; Mark dropped it 2026-05-06 because the h1
          already says the same thing and the chip ate vertical room
          on mobile. */}
      <h1 style={{
        fontSize: 17, fontWeight: 600,
        color: "var(--text1)", margin: "0 0 14px", lineHeight: 1.3,
      }}>
        Someone sent you a watch on Watchlist.
      </h1>

      {sharedItem ? (
        <div className="share-receiver-wide-grid" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 16,
          alignItems: "stretch",
        }}>
          <style>{`
            @media (min-width: 1100px) {
              .share-receiver-wide-grid {
                grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr) !important;
              }
            }
          `}</style>
          <FocusedShareCard
            item={sharedItem}
            isAlreadySaved={!!isAlreadySaved}
            user={user}
            busy={busy}
            isAuthConfigured={isAuthConfigured}
            signInWithGoogle={signInWithGoogle}
            onSave={onSave}
            onDismiss={onDismiss}
            onClickListing={onClickListing}
            fmtPriceLine={fmtPriceLine}
          />
          <OrientationAnchors
            signedIn={!!user}
            onClickAnchor={onClickAnchor}
          />
        </div>
      ) : (
        <div style={{
          padding: "32px 24px", borderRadius: 12,
          border: "0.5px solid var(--border)", background: "var(--card-bg)",
          // Light-mode lift: --card-bg is #fff (same as page) in light
          // mode, so without a shadow the card has no tone shift. The
          // shadow disappears against #000 in dark mode (no harm).
          boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)",
          fontSize: 14, color: "var(--text2)", lineHeight: 1.6,
          maxWidth: 720,
        }}>
          The shared listing isn't in the feed right now — the dealer may have removed it, or
          it has scrolled off the active list. Browse the rest of Watchlist below.
          <div style={{ marginTop: 14 }}>
            <button onClick={() => onClickAnchor("listings")} style={anchorBtnStyle}>
              Browse all listings →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FocusedShareCard ───────────────────────────────────────────────
// The two-column landing surface. Left = image. Right = details +
// save / dismiss / dealer link. Stacks on mobile via the gridTemplate
// switch at the breakpoint.
function FocusedShareCard({
  item,
  isAlreadySaved,
  user,
  busy,
  isAuthConfigured,
  signInWithGoogle,
  onSave,
  onDismiss,
  onClickListing,
  fmtPriceLine,
}) {
  return (
    <div style={{
      display: "grid",
      // Two columns ≥720px, single column below. Right pane has a
      // fixed minimum so the CTAs don't crush at narrow desktop.
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: 0,
      borderRadius: 12,
      overflow: "hidden",
      border: "0.5px solid var(--border)",
      background: "var(--card-bg)",
      // Light-mode lift: --card-bg is #fff (same as page bg) in
      // light mode, so without a shadow the card has no tone shift.
      // Shadow disappears against #000 in dark mode (no harm).
      boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)",
    }}
    className="share-receiver-focused-card"
    >
      <style>{`
        /* Mobile-first defaults are tight so action buttons sit
           above the fold on a typical phone (~670px viewport).
           Both desktop expansions kick in together at 720px. */
        .share-receiver-focused-card .share-receiver-image-pane {
          aspect-ratio: 16 / 10;
        }
        .share-receiver-focused-card .share-receiver-details-pane {
          padding: 14px 14px 16px;
          gap: 9px;
        }
        .share-receiver-focused-card .share-receiver-action-hint {
          display: none;
        }
        .share-receiver-focused-card .share-receiver-spacer {
          display: none;
        }
        @media (min-width: 720px) {
          .share-receiver-focused-card {
            grid-template-columns: 1fr 1fr !important;
          }
          .share-receiver-focused-card .share-receiver-image-pane {
            aspect-ratio: 4 / 3;
          }
          .share-receiver-focused-card .share-receiver-details-pane {
            padding: 24px 22px;
            gap: 14px;
          }
          .share-receiver-focused-card .share-receiver-action-hint {
            display: block;
          }
          .share-receiver-focused-card .share-receiver-spacer {
            display: block;
          }
        }
      `}</style>

      {/* Image pane */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { if (onClickListing) onClickListing(item); }}
        className="share-receiver-image-pane"
        style={{
          position: "relative",
          display: "block",
          // aspect-ratio handled by CSS class so the mobile (16:10)
          // and desktop (4:3) values can swap at the breakpoint.
          background: "var(--surface)",
          textDecoration: "none",
        }}
        title={`Open ${item.source} listing in a new tab`}
      >
        {item.img ? (
          <img
            src={imgSrc(item.img)}
            alt={item.ref || item.title || "shared watch"}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
            }}
            loading="eager"
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text3)", fontSize: 14,
          }}>No image</div>
        )}
        {item.sold && (
          <span style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(0,0,0,0.7)", color: "#fff",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            padding: "4px 8px", borderRadius: 4,
            textTransform: "uppercase",
          }}>Sold</span>
        )}
      </a>

      {/* Details pane — padding + gap handled by CSS class so they
          can tighten on mobile and expand on desktop. */}
      <div className="share-receiver-details-pane" style={{
        display: "flex", flexDirection: "column",
        minWidth: 0,
      }}>
        {/* Source + brand */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          gap: 12, flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--text2)",
          }}>{item.source || ""}</span>
          {item.brand && (
            <span style={{
              fontSize: 12, color: "var(--text2)",
            }}>{item.brand}</span>
          )}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 18, fontWeight: 600,
          color: "var(--text1)", margin: 0, lineHeight: 1.3,
        }}>
          {item.ref || item.title || "Watch"}
        </h2>

        {/* Price */}
        {(item.price || item.priceUSD) ? (
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)" }}>
            {fmtPriceLine(item) || (item.price ? fmt(item.price, item.currency || "USD") : "")}
          </div>
        ) : null}

        {/* Dealer link */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { if (onClickListing) onClickListing(item); }}
          style={{
            fontSize: 13, color: "var(--text2)",
            textDecoration: "underline",
            wordBreak: "break-word",
          }}
        >
          Open on {item.source || "dealer site"} →
        </a>

        {/* Spacer pushes actions to the bottom of the pane on
            desktop. Hidden on mobile (CSS class) so the actions
            sit immediately under the dealer link and stay above
            the fold on phone viewports. */}
        <div className="share-receiver-spacer" style={{ flex: 1, minHeight: 12 }} />

        {/* Action buttons */}
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap",
        }}>
          {user ? (
            <>
              <button
                onClick={onSave}
                disabled={busy || isAlreadySaved}
                style={{
                  ...primaryBtnStyle,
                  opacity: (busy || isAlreadySaved) ? 0.6 : 1,
                  cursor: busy ? "wait" : (isAlreadySaved ? "default" : "pointer"),
                }}
              >
                {isAlreadySaved ? "Already saved" : (busy ? "Saving…" : "Save to my list")}
              </button>
              <button onClick={onDismiss} disabled={busy} style={secondaryBtnStyle}>
                Dismiss
              </button>
            </>
          ) : (
            <>
              {isAuthConfigured && signInWithGoogle && (
                <button onClick={signInWithGoogle} style={primaryBtnStyle}>
                  Sign in to save
                </button>
              )}
              <button onClick={onDismiss} style={secondaryBtnStyle}>
                Just browse
              </button>
            </>
          )}
        </div>

        <div className="share-receiver-action-hint" style={{
          fontSize: 12, color: "var(--text3)", lineHeight: 1.5, marginTop: 4,
        }}>
          {user
            ? <>Save adds to your default list <strong style={{ color: "var(--text2)" }}>and</strong> a separate <strong style={{ color: "var(--text2)" }}>Shared with me</strong> inbox so you can find it again.</>
            : <>No account is needed to follow the dealer link. Sign in only if you want to save it for later.</>
          }
        </div>
      </div>
    </div>
  );
}

// ── OrientationAnchors ─────────────────────────────────────────────
// First-time-visitor onboarding. Lives in the right column on wide
// desktop (≥1100px), beside the focused share card; stacks below
// the card on narrower / mobile. Stacked-button layout reads well
// in either column orientation — no internal flex-wrap needed.
function OrientationAnchors({ signedIn, onClickAnchor }) {
  return (
    <div style={{
      borderRadius: 12,
      border: "0.5px solid var(--border)",
      background: "var(--card-bg)",
      // Same lift treatment as the focused card so the two read as
      // a paired surface in light mode where --card-bg = --bg.
      boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 16px 40px rgba(0,0,0,0.12)",
      padding: "18px 18px 16px",
      display: "flex", flexDirection: "column",
      // Stretch to match the focused card height on wide so the two
      // panes are visually balanced.
      minHeight: 0,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.06em",
        color: "var(--text3)", marginBottom: 8,
      }}>
        First time on Watchlist?
      </div>
      <p style={{
        margin: "0 0 14px", fontSize: 13, color: "var(--text2)",
        lineHeight: 1.5,
      }}>
        Watchlist is a vintage watch aggregator from independent dealers and auction houses.
        One feed to manage watchlists, no ads, and it's free.
      </p>
      <div style={{
        display: "flex", flexDirection: "column", gap: 8,
      }}>
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
  );
}

const primaryBtnStyle = {
  border: "none",
  background: "#185FA5",
  color: "#fff",
  padding: "10px 18px",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};

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
