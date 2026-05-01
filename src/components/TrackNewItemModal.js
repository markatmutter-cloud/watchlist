import React from "react";
import { modalBackdrop, modalCloseButton } from "../styles";

// Track new item modal — single-URL paste flow with source-list
// instructions. Lifted out of App.js on 2026-04-30 (was an inline JSX
// const next to favSearchModalJSX). Takes its trigger state and submit
// handler as props so the parent owns the URL state machine.
//
// `inp` is passed through rather than imported from styles.js because
// it's a parent-owned input style that's used in multiple inputs across
// the app. Once styles.js absorbs `inp`, this prop can drop.
export function TrackNewItemModal({
  open, setOpen,
  trackUrl, setTrackUrl,
  trackError, setTrackError,
  submitTrack, trackBusy,
  inp,
}) {
  if (!open) return null;
  return (
    <div onClick={() => setOpen(false)} style={modalBackdrop}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--card-bg)",
        border: "0.5px solid var(--border)",
        borderRadius: 14,
        padding: "20px 22px",
        width: "100%", maxWidth: 520,
        color: "var(--text1)", fontFamily: "inherit",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Track new item</div>
          <button onClick={() => setOpen(false)} aria-label="Close" style={modalCloseButton}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14, lineHeight: 1.5 }}>
          Paste an auction lot URL or marketplace listing URL. The
          tracked item appears in your Watchlist and refreshes on
          the next scrape (current bid, hammer price, end time).
        </div>
        <input
          autoFocus
          value={trackUrl}
          onChange={e => { setTrackUrl(e.target.value); setTrackError(""); }}
          onKeyDown={e => { if (e.key === "Enter") submitTrack(); }}
          placeholder="https://..."
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={{ ...inp, width: "100%", fontSize: 13, marginBottom: 8 }}
        />
        {trackError && (
          <div style={{ fontSize: 11, color: "#c0392b", marginBottom: 8 }}>{trackError}</div>
        )}
        <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.55, marginBottom: 14 }}>
          Supported sources:
          {" "}Antiquorum (live + catalog),
          {" "}Christie's,
          {" "}Sotheby's,
          {" "}Monaco Legend,
          {" "}Phillips,
          {" "}eBay (auction or Buy-It-Now).
          {" "}Bonhams + Chrono24 are blocked by their bot walls and need Mac mini infra (deferred).
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setOpen(false)} style={{
            border: "0.5px solid var(--border)", background: "transparent",
            color: "var(--text2)", padding: "8px 16px", borderRadius: 8,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13,
          }}>Cancel</button>
          <button onClick={submitTrack} disabled={trackBusy || !trackUrl.trim()} style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: (trackBusy || !trackUrl.trim()) ? 0.5 : 1,
          }}>{trackBusy ? "Tracking…" : "Track"}</button>
        </div>
      </div>
    </div>
  );
}
