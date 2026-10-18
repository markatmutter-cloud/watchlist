import React from "react";
import CardShell from "./CardShell";
import LumeReasonChip from "./LumeReasonChip";
import { Button } from "../ui";
import { imgSrc } from "../utils";
import { reasonFor, timeOnMarket } from "../lumeReasons";

// LumeLead — the ONE "Start here" hero (Mark's revised spec). A clear lead idea
// with VISIBLE evidence: eyebrow + headline + dek, the specific basis (the saved
// search) shown as a chip, 2-3 evidence cards each carrying its reason + time on
// market, and two CTAs (review / ask Lumé). This is the page's single lead;
// everything below is supporting.

function EvidenceCard({ item, reasonSource, onOpenItem }) {
  const name = `${item.brand || ""} ${item.model || item.model_line || item.ref || ""}`.trim() || "Watch";
  const price = item.priceUSD ? `$${Number(item.priceUSD).toLocaleString()}` : "";
  const time = timeOnMarket(item);
  const reason = reasonFor(item, reasonSource);
  return (
    <CardShell
      href={item.url}
      aspect="square"
      onClickLink={onOpenItem ? (e) => { if (e && e.preventDefault) e.preventDefault(); onOpenItem(item.url); } : undefined}
      image={item.img ? { src: imgSrc(item.img, 360), alt: "" } : null}
      level2={reason ? <div style={{ marginBottom: 4 }}><LumeReasonChip label={reason} tone="accent" /></div> : null}
      level1={<div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{name}</div>}
      level3={<div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{[time, price].filter(Boolean).join(" · ")}</div>}
    />
  );
}

export default function LumeLead({ lead, onPrimary, onSecondary, onOpenItem, isMobile }) {
  if (!lead) return null;
  const { eyebrow, headline, dek, searchLabel, items = [], reasonSource, primaryCta, secondaryCta } = lead;

  return (
    <section style={{
      border: "0.5px solid var(--border)", borderRadius: 20, padding: isMobile ? 18 : 24,
      background: "var(--brand-olive-tint, rgba(125,134,94,0.10))", display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {eyebrow && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: "var(--brand-olive)" }}>{eyebrow}</div>
        )}
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 27, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.2, color: "var(--text1)" }}>{headline}</h1>
        {dek && <div style={{ fontSize: isMobile ? 14 : 15, lineHeight: 1.55, color: "var(--text2)", maxWidth: 620 }}>{dek}</div>}
        {searchLabel && (
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            Basis: <strong style={{ color: "var(--text1)" }}>your "{searchLabel}" saved search</strong>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, isMobile ? 2 : 3)}, 1fr)`, gap: 10 }}>
          {items.slice(0, isMobile ? 2 : 3).map((it, i) => (
            <div key={it.id || it.url || i} style={{ background: "var(--card-bg)", borderRadius: 12, overflow: "hidden" }}>
              <EvidenceCard item={it} reasonSource={reasonSource} onOpenItem={onOpenItem} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
        {primaryCta && (
          <Button primary inline onClick={onPrimary}>{primaryCta}</Button>
        )}
        {secondaryCta && (
          <Button inline onClick={onSecondary}>{secondaryCta}</Button>
        )}
      </div>
    </section>
  );
}
