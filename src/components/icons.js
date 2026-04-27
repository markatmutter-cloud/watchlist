import React from "react";

export function HeartIcon({ filled, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

export function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="8" y1="12" x2="20" y2="12"/>
      <line x1="12" y1="18" x2="20" y2="18"/>
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

// Small leading icons for the tab buttons. Sized 12 so they sit just
// inside the pill text without stealing real estate.
export function TabIcon({ kind }) {
  const props = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none",
                  stroke: "currentColor", strokeWidth: 2,
                  strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "listings") return (
    <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
  );
  if (kind === "auctions") return (
    <svg {...props}><path d="M14 12.5L7 19.5"/><path d="m20 4-8 8"/>
      <path d="m17 1-7 7 5 5 7-7-5-5z"/><path d="M3 21h12"/></svg>
  );
  if (kind === "searches") return (
    <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
  );
  if (kind === "watchlist") return (
    <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
  );
  return null;
}
