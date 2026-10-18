import React from "react";
import CardStrip from "./CardStrip";
import { Pill } from "../ui";

// LumeModule — a curated supporting shelf (Worth your attention / Useful comps /
// Rabbit holes). Editorial framing carries it: an eyebrow, a heading, a one-line
// "why it matters" dek, then a horizontal strip of reason-chipped cards, and one
// CTA. The raw count is demoted to small muted metadata (Mark: counts are
// metadata, not the hook).
export default function LumeModule({ eyebrow, heading, dek, count, items, renderCard, isMobile, ctaLabel, onCta }) {
  if (!items || !items.length) return null;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: isMobile ? "0 16px" : "0 4px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          {eyebrow && (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--brand-olive)" }}>{eyebrow}</div>
          )}
          <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 19, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text1)" }}>{heading}</h2>
          {dek && <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text2)" }}>{dek}</div>}
        </div>
        {(ctaLabel || count != null) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            {ctaLabel && (
              <Pill onClick={onCta}>{ctaLabel}</Pill>
            )}
            {count != null && count > items.length && (
              <span style={{ fontSize: 11, color: "var(--text3)" }}>{count} total</span>
            )}
          </div>
        )}
      </div>
      <CardStrip items={items} renderCard={renderCard} isMobile={isMobile} />
    </section>
  );
}
