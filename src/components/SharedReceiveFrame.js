import React from "react";
import { Pill, Button, ModalClose } from "../ui";

// SharedReceiveFrame — the ONE shell every "shared with you" / library surface
// wraps (Mark 2026-06-01). It owns the common chrome + language + layout so a
// change here propagates to every shared object type (listing · auction catalog
// · list · article · reference guide · challenge): change the attribution line
// or the action-bar geometry once, and all types update. Types supply only
// DATA via the descriptor — never their own layout — so they physically can't
// diverge on chrome, and can only differ where the contract grants a slot.
//
// Contract (the descriptor):
//   sender       string | ""            — who shared it ("" → "Shared with you")
//   typeLabel    string                 — "watch" / "reference guide" / …
//   isLume       bool                   — Lumé curated it (warmer attribution)
//   hero         JSX                    — the identity/hero zone interior
//   identity     JSX                    — title + sub-identity block
//   primaryCTA   { label, href?, onClick? } — the one type-specific verb (olive)
//   signedIn     bool
//   onSave       () => void | null      — Save (heart). null hides it.
//   saved        bool
//   onSignIn     () => void | null      — signed-out → "Sign in to save"
//   onAddToList  () => void | null      — signed-in only
//   onShare      () => void | null
//   extraActions [{ label, onClick }]   — item-specific slot (e.g. catalog "Remind me")
//   navCues      [{ label, onClick }]   — no-dead-end cues
//   busy         bool
//
// Self-contained presentational shell — no hooks, no data fetch. The type
// adapters (which DO have hooks/URL/data) render this.

export function SharedReceiveFrame({
  sender = "",
  typeLabel = "item",
  isLume = false,
  hero,
  identity,
  primaryCTA,
  signedIn = false,
  onSave,
  saved = false,
  onSignIn,
  onAddToList,
  onShare,
  extraActions = [],
  navCues = [],
  busy = false,
  onClose,
}) {
  const attribution = sender
    ? (isLume ? `Lumé picked this ${typeLabel} for you` : `${sender} shared a ${typeLabel} with you`)
    : `Shared with you`;

  return (
    <div style={{ position: "relative", padding: "16px 16px 110px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {/* [0] Close — a top-RIGHT × (Mark: clicking a link then mousing to a
          top-left Back is wrong; × where the eye expects close). Returns the
          user to where they were browsing; only when wired. */}
      {onClose && (
        <ModalClose float onClose={onClose} />
      )}
      {/* [A] Attribution — the single line of chrome copy; no explainer. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingRight: onClose ? 40 : 0 }}>
        <span aria-hidden style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 999,
          background: "var(--brand-olive-tint-12)", color: "var(--brand-olive-ink)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
        }}>{sender ? sender.charAt(0).toUpperCase() : "♡"}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--text2)",
        }}>{attribution}</span>
      </div>

      {/* [B/C] Hero + identity + actions — two columns on desktop (hero left,
          details right), stacked on mobile. Hero depth scales with viewport. */}
      <div className="srf-card" style={{
        borderRadius: 12, overflow: "hidden", border: "0.5px solid var(--border)",
        background: "var(--card-bg)", boxShadow: "var(--shadow-modal)",
        display: "grid", gridTemplateColumns: "1fr", alignItems: "stretch",
      }}>
        <style>{`
          /* min-height floor guarantees a visible image box even if a browser
             computes aspect-ratio to 0 for an all-absolutely-positioned hero. */
          .srf-hero { aspect-ratio: 16 / 10; position: relative; background: var(--surface); min-height: 240px; }
          .srf-body { min-width: 0; }
          /* Two columns only when there's genuine room. The image column gets a
             real minimum (300px) so a long title can't squeeze it to nothing —
             which made the picture vanish at half-width (Mark). Below this we
             fall back to the stacked mobile layout (image on top), so there's
             always a picture. */
          @media (min-width: 900px) {
            .srf-card { grid-template-columns: minmax(320px, 1.2fr) minmax(0, 1fr) !important; }
            .srf-hero { aspect-ratio: auto !important; height: 100%; min-height: clamp(420px, 64vh, 660px); }
          }
        `}</style>
        <div className="srf-hero">{hero}</div>
        <div className="srf-body" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ padding: "16px 18px 4px" }}>{identity}</div>
          {/* [C] Action bar — fixed verb order; one olive primary. */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 18px 18px" }}>
            {primaryCTA && (primaryCTA.href
              ? <Pill primary href={primaryCTA.href} onClick={primaryCTA.onClick}>{primaryCTA.label}</Pill>
              : <Pill primary onClick={primaryCTA.onClick}>{primaryCTA.label}</Pill>)}
            {signedIn ? (
              <>
                {onSave && (
                  <Pill on={saved} onClick={onSave} disabled={busy || saved}>
                    {saved ? "♥ Saved" : (busy ? "Saving…" : "♡ Save")}
                  </Pill>
                )}
                {onAddToList && <Pill onClick={onAddToList}>Add to list</Pill>}
              </>
            ) : (
              onSignIn && <Pill onClick={onSignIn}>Sign in to save</Pill>
            )}
            {extraActions.map((a) => (
              <Pill key={a.label} onClick={a.onClick}>{a.label}</Pill>
            ))}
            {onShare && <Pill onClick={onShare}>Share</Pill>}
            {/* "Ask Lumé" is NOT a button here (Mark 2026-06-01) — the floating
                Lumé launcher stays on the surface and pops out an "Ask Lumé"
                callout, opening seeded with this item (see ChatBubbleHost). */}
          </div>
        </div>
      </div>

      {/* [E] Navigation cues — quiet, no dead end. */}
      {navCues.length > 0 && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 16 }}>
          {navCues.map((c) => (
            <Button link key={c.label} onClick={c.onClick}>{c.label}</Button>
          ))}
        </div>
      )}
    </div>
  );
}

