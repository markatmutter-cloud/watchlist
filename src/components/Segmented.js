import React from "react";

// Filled pill-track with sliding active background. Distinct visual
// register from styles.js's `tabPill` (underline) and
// `innerToggleButton` (single-border pill row) — see the mockup,
// section 1 ("Primitive components" / "Segmented control").
//
// Used by:
//   - Manage modal Collaboration / View only toggle
//   - Listings sub-tabs All / Live / Auctions / Sold / Calendar
//
// Props:
//   options  — [{ value, label }]
//   value    — currently selected value
//   onChange — (newValue) => void

export function Segmented({ options, value, onChange }) {
  return (
    <div style={{
      display: "inline-flex",
      background: "var(--surface-2)",
      borderRadius: 999,
      padding: 2,
    }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              fontSize: 10.5,
              padding: "4px 10px",
              borderRadius: 999,
              color: active ? "var(--ink-1)" : "var(--ink-2)",
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              background: active ? "var(--bg)" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
