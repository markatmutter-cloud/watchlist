import React from "react";

// Pill-style filter button used in mobile filter row + auctions tab.
export function Chip({ label, active, onClick, blue, count }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: "4px 12px", borderRadius: 20, cursor: "pointer",
      fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
      background: active ? "var(--text1)" : "transparent",
      color: active ? "var(--bg)" : blue ? "var(--brand)" : "var(--text2)",
      boxShadow: active ? "none" : `inset 0 0 0 0.5px ${blue ? "var(--brand)" : "var(--border)"}`,
    }}>
      {label}{count !== undefined ? ` · ${count}` : ""}
    </button>
  );
}

// Smaller pill used in the desktop sidebar (denser layout).
export function SidebarChip({ label, active, onClick, blue }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: "2px 10px", borderRadius: 20, cursor: "pointer",
      fontFamily: "inherit", whiteSpace: "nowrap", border: "none", outline: "none",
      background: active ? "var(--text1)" : "transparent",
      color: active ? "var(--bg)" : blue ? "var(--brand)" : "var(--text2)",
      boxShadow: active ? "none" : `inset 0 0 0 0.5px ${blue ? "var(--brand)" : "var(--border)"}`,
      marginBottom: 4, marginRight: 4,
    }}>
      {label}
    </button>
  );
}
