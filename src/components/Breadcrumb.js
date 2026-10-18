import React from "react";
import { Button } from "../ui";

// Shared breadcrumb trail. `items` = [{ label, onClick? }]. The last item is
// the current crumb (non-clickable, emphasised); earlier crumbs with an
// onClick render as buttons. Query-param navigation lives in the caller — this
// is presentational only. Built for the reference browse surface; reusable by
// the dossier later (see docs/IA_REDESIGN.md "dispatch layer").
export function Breadcrumb({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: "var(--text3)",
        margin: "2px 0 12px",
      }}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {it.onClick && !last ? (
              <Button link muted onClick={it.onClick} style={{ padding: 0 }}>{it.label}</Button>
            ) : (
              <span
                style={{
                  color: last ? "var(--text1)" : "var(--text3)",
                  fontWeight: last ? 600 : 400,
                }}
              >
                {it.label}
              </span>
            )}
            {!last && <span style={{ color: "var(--text3)" }}>›</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
