import React, { useState, useEffect, useCallback } from "react";
import { sharedParam } from "../receiveIntent";
import { imgSrc, fmtSaleDateRange } from "../utils";
import { SharedReceiveFrame, ShareEyebrow, ShareTitle, ShareSub, ShareEmpty } from "./SharedReceiveFrame";

// Auction-catalog share-receive surface (Mark 2026-06-02). Same isolation
// pattern as ShareReceiver / ListReceiver — all hooks live inside; App.js only
// mirrors a one-bit `catalogShareActive` so the shells gate browse chrome.
//
// URL: `?catalog=<saleUrl>&shared=1` (+ optional `from`). The Share button on
// the catalog header builds this IN-APP link (it used to share the raw auction-
// house URL, which dead-ended off the platform — Mark). Opening it lands on the
// unified frame: "X shared an auction catalog with you" + a cover collage + the
// lot count, with "View catalog" (opens it in-app) and Save.

export function CatalogReceiver({
  user,
  isAuthConfigured,
  signInWithGoogle,
  salesByUrl,
  lotsByAuctionUrl,
  auctionHeroByUrl = {},
  lotCountsByAuctionUrl = {},
  savedAuctionUrlSet,
  toggleSavedAuction,
  onOpenCatalog,          // (saleUrl) => open the catalog in-app
  setCatalogShareActive,
  setTab,
  resetTick,
}) {
  const [catalogUrl, setCatalogUrl] = useState(() => sharedParam("catalog"));
  const [fromName, setFromName] = useState("");

  // Parse URL on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("catalog") && params.get("shared") === "1") {
        setCatalogUrl(params.get("catalog"));
        const from = params.get("from");
        if (from) setFromName(from);
      }
    } catch (e) {
      console.warn("catalog URL parse failed", e);
    }
  }, []);

  // Mirror to parent for shell chrome gating.
  useEffect(() => {
    if (typeof setCatalogShareActive === "function") setCatalogShareActive(!!catalogUrl);
  }, [catalogUrl, setCatalogShareActive]);

  // External escape signal — clear intent on bump.
  useEffect(() => {
    if (resetTick && resetTick > 0) { setCatalogUrl(null); setFromName(""); }
  }, [resetTick]);

  const clearIntent = useCallback(() => {
    setCatalogUrl(null);
    setFromName("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("catalog");
      url.searchParams.delete("shared");
      url.searchParams.delete("from");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const onJustBrowse = useCallback(() => {
    clearIntent();
    if (typeof setTab === "function") setTab("listings");
  }, [clearIntent, setTab]);

  const onView = useCallback(() => {
    if (!catalogUrl) return;
    clearIntent();
    if (typeof onOpenCatalog === "function") onOpenCatalog(catalogUrl);
  }, [catalogUrl, clearIntent, onOpenCatalog]);

  if (!catalogUrl) return null;

  const sender = (fromName || "").trim();
  const sale = salesByUrl && salesByUrl.get ? salesByUrl.get(catalogUrl) : null;

  // Catalog not in the current feed (rolled off / wrong link) — no dead end.
  if (!sale) {
    return (
      <SharedReceiveFrame
        sender={sender}
        typeLabel="auction catalog"
        hero={<ShareEmpty><span>This auction catalog isn't available right now</span></ShareEmpty>}
        identity={
          <>
            <ShareTitle>This catalog isn't available</ShareTitle>
            <ShareSub>It may have closed and rolled off. The rest of Watchlist is here.</ShareSub>
          </>
        }
        primaryCTA={{ label: "Browse Watchlist →", onClick: onJustBrowse }}
        signedIn={!!user}
      />
    );
  }

  const lots = (lotsByAuctionUrl && lotsByAuctionUrl.get) ? (lotsByAuctionUrl.get(catalogUrl) || []) : [];
  const lotCount = lotCountsByAuctionUrl[catalogUrl] || lots.length || 0;
  const covers = coverImages(lots, auctionHeroByUrl[catalogUrl]);
  const saved = !!(savedAuctionUrlSet && savedAuctionUrlSet.has && savedAuctionUrlSet.has(catalogUrl));
  const eyebrow = `${sale.house || ""}${sale.location ? ` · ${sale.location}` : ""}${
    fmtSaleDateRange(sale) ? ` · ${fmtSaleDateRange(sale)}` : ""}`.replace(/^ · /, "");

  return (
    <SharedReceiveFrame
      sender={sender}
      typeLabel="auction catalog"
      hero={coverHero(covers)}
      identity={
        <>
          <ShareEyebrow>{eyebrow}</ShareEyebrow>
          <ShareTitle>{sale.title || "Auction catalog"}</ShareTitle>
          <ShareSub>{lotCount ? `${lotCount} lot${lotCount === 1 ? "" : "s"}` : "Auction catalog"}</ShareSub>
        </>
      }
      primaryCTA={{ label: "View catalog →", onClick: onView }}
      signedIn={!!user}
      onSave={(user && toggleSavedAuction) ? () => toggleSavedAuction(catalogUrl) : null}
      saved={saved}
      onSignIn={(!user && isAuthConfigured && signInWithGoogle) ? signInWithGoogle : null}
      extraActions={sale.url ? [{ label: "Auction house ↗", onClick: () => window.open(sale.url, "_blank", "noopener,noreferrer") }] : []}
      navCues={[{ label: "Just browse", onClick: onJustBrowse }]}
    />
  );
}

// Up to four lot covers for the catalog collage; falls back to the sale hero.
function coverImages(lots, heroImg) {
  const out = [];
  for (const lot of lots || []) {
    if (out.length >= 4) break;
    if (lot && lot.img) out.push(imgSrc(lot.img));
  }
  if (out.length === 0 && heroImg) out.push(imgSrc(heroImg));
  return out;
}

function coverHero(covers) {
  if (!covers || covers.length === 0) {
    return (
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text3)", fontSize: 13,
      }}>
        <span style={{ fontSize: 30 }}>🔨</span>
        <span>Auction catalog</span>
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

