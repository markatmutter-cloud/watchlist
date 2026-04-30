import React from "react";

export function AboutModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: 14,
        border: "0.5px solid var(--border)",
        padding: 22, maxWidth: 440, width: "100%", maxHeight: "85vh",
        overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text1)" }}>About Watchlist</div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 18 }}>
          A personal aggregator for vintage watch listings from a handful of dealers I follow,
          plus tracked auction lots from a couple of houses. Passion project — no revenue, no
          affiliate links, no tracking. Listings link straight back to the dealers.
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Get in touch
        </div>
        <a href="https://instagram.com/lagunabeachwatch" target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 8,
            border: "0.5px solid var(--border)", background: "var(--card-bg)",
            color: "var(--text1)", textDecoration: "none",
            fontFamily: "inherit", fontSize: 14, fontWeight: 500,
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          @lagunabeachwatch
        </a>
      </div>
    </div>
  );
}
