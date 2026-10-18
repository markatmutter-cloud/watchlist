import React, { useState } from "react";
import CardStrip from "./CardStrip";
import { Pill } from "../ui";

// LumeResultGrid — the missing vertical-grid primitive for the Lumé canvas.
// Shows a tidy PREVIEW grid of result cards (tap to open, easy to skip), then
// a "Show N more" affordance that reveals the remainder as a horizontal-scroll
// CardStrip (Mark: "click more to reveal more cards / horizontal scroll").
//
// Slot-agnostic like CardStrip: the caller passes `renderCard(item, i)` so the
// same grid lays out listing cards, auction cards, or article cards identically.
export default function LumeResultGrid({ items, renderCard, isMobile, preview = 6 }) {
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(items) ? items : [];
  const head = list.slice(0, preview);
  const rest = list.slice(preview);

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 190}px, 1fr))`,
    gap: 8,
  };

  return (
    <div>
      <div style={gridStyle}>
        {head.map((it, i) => (
          <div key={it.id || it.url || i} style={{ background: "var(--card-bg)", position: "relative" }}>
            {renderCard(it, i)}
          </div>
        ))}
      </div>

      {rest.length > 0 && !expanded && (
        <div style={{ marginTop: 12 }}><Pill quiet onClick={() => setExpanded(true)}>Show {rest.length} more →</Pill></div>
      )}

      {expanded && rest.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <CardStrip items={rest} renderCard={renderCard} isMobile={isMobile} />
        </div>
      )}
    </div>
  );
}
