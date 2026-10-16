import React from "react";
import { LOOK, magLabel } from "../styles";

// PageHeader — the one bleed-bar page header (Mark 2026-06-01). Standardizes
// the auction-catalog title treatment he liked into a shared component used
// across the named, finite surfaces (Lists ▸ Saved/Lists/Searches · Reference
// guides · the drilled-in auction catalog). Tells you "what you're looking at"
// in one place; sits BELOW the SubTabBar, ABOVE the filter bar.
//
// Restrained per BRAND.md: a hairline-bordered band on --bg (NOT a tinted slab),
// bold-sans title (chrome = scan-and-act, never serif). Eyebrow → title → a
// meta + right-aligned actions row. Optional back/exit link (drill-ins).
//
// Reading surfaces (Articles, ReferencePage) and the infinite live feed opt out
// — PageHeader is for "you've arrived at a named, finite view."
//
//   actions: [{ label, onClick, href?, icon?, active? }]
//   onExit:  () => void   — renders a "← {exitLabel}" link above the eyebrow
//   trailing: JSX — rendered after the action pills (for composed controls a
//             plain {label,onClick} can't express, e.g. the in-list ⋯ menu)
//   count:   string — RIGHT-aligned item count, for surfaces WITHOUT a filter
//            bar (Lists, Searches). Surfaces with a bar pass null — there the
//            count's one home is the bar's reserved right slot (P-8). Never
//            put a count in `meta` (left/under-title is the placement Mark
//            vetoed on the 2026-06-03 verification pass).

export function PageHeader({ eyebrow, title, meta, count, actions = [], onExit, exitLabel = "Back", isMobile, trailing = null }) {
  return (
    <div style={{
      borderBottom: "0.5px solid var(--border)", background: "var(--bg)",
      // ONE-INSET RULE (P-5/P-6, 2026-06-03): the header carries NO horizontal
      // padding of its own — the surface's container provides the standard
      // inset (20px desktop pane / 16px mobile body), so the title, the
      // hairline's endpoints, and the filter pills below all share ONE left
      // edge. The old self-padding (14/20) double-stacked with container
      // padding on some surfaces (title at 40px while pills sat at 20) and
      // bleed-wrappers ran the hairline edge-to-edge on others — exactly the
      // per-surface drift this component exists to prevent.
      padding: isMobile ? "10px 0 13px" : "14px 0 16px",
    }}>
      {onExit && (
        <button onClick={onExit}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 8,
            padding: 0, border: "none", background: "transparent", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--text2)",
          }}>← {exitLabel}</button>
      )}
      {eyebrow && (
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--brand-olive-text)",
        }}>{eyebrow}</div>
      )}
      {/* ONE-ROW HEADER (Mark 2026-06-03): the right cluster (actions · ⋯ ·
          count) sits INLINE with the title, not on a second row below it —
          the second row made Lists/Searches taller than Saved's tight
          title→hairline band, and the narrow look is the standard. `meta`
          (rare — e.g. "Shared by X") is the only thing that adds a line. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        marginTop: eyebrow ? 5 : 0,
      }}>
        <div style={{
          fontSize: isMobile ? 23 : 28, fontWeight: 700, color: "var(--text1)",
          lineHeight: 1.12, letterSpacing: "-0.01em", minWidth: 0,
        }}>{title}</div>
        {(actions.length > 0 || count || trailing) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            {actions.map((a) => {
              const style = {
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "5px 12px",
                borderRadius: 999, border: "0.5px solid var(--border)",
                background: a.active ? "var(--brand-olive-tint-12)" : "var(--surface)",
                color: a.active ? "var(--brand-olive-ink)" : "var(--text1)",
                textDecoration: "none",
              };
              return a.href ? (
                <a key={a.label} href={a.href} onClick={a.onClick} style={style}
                  target={a.external ? "_blank" : undefined}
                  rel={a.external ? "noopener noreferrer" : undefined}>
                  {a.icon}{a.label}
                </a>
              ) : (
                <button key={a.label} onClick={a.onClick} aria-label={a.ariaLabel || a.label} style={style}>
                  {a.icon}{a.label}
                </button>
              );
            })}
            {trailing}
            {count && (
              <span style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap", marginLeft: 4,
                             ...(LOOK.magazine ? { ...magLabel(), fontVariantNumeric: "tabular-nums" } : {}) }}>
                {count}
              </span>
            )}
          </div>
        )}
      </div>
      {meta && (
        <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>{meta}</div>
      )}
    </div>
  );
}
