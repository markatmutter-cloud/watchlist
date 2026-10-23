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
// adapters (which DO have hooks/URL/data) render this. Identity blocks use the
// ShareEyebrow / ShareTitle / ShareSub / SharePrice pieces below so every type
// reads the same (styles: .ui-share-* in src/ui/ui.css).

export function ShareEyebrow({ children }) { return children ? <div className="ui-share-eyebrow">{children}</div> : null; }
export function ShareTitle({ children }) { return <h2 className="ui-share-title">{children}</h2>; }
export function ShareSub({ children }) { return children ? <div className="ui-share-sub">{children}</div> : null; }
export function SharePrice({ children }) { return children ? <div className="ui-share-price">{children}</div> : null; }
export function ShareEmpty({ children }) { return <div className="ui-share-empty">{children}</div>; }

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
    <div className="ui-share">
      {/* [0] Close — a top-RIGHT × (Mark: clicking a link then mousing to a
          top-left Back is wrong; × where the eye expects close). Returns the
          user to where they were browsing; only when wired. */}
      {onClose && <ModalClose float onClose={onClose} />}
      {/* [A] Attribution — the single line of chrome copy; no explainer. */}
      <div className="ui-share-from">
        <span aria-hidden className="ui-share-disc">{sender ? sender.charAt(0).toUpperCase() : "♡"}</span>
        <span className="ui-share-attrib">{attribution}</span>
      </div>

      {/* [B/C] Hero + identity + actions — two columns when the frame is wide
          (hero left, details right), stacked on a phone. Styles: ui.css. */}
      <div className="ui-share-card">
        <div className="ui-share-hero">{hero}</div>
        <div className="ui-share-body">
          <div>{identity}</div>
          {/* [C] Action bar — fixed verb order; one olive primary. */}
          <div className="ui-share-acts">
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
        <div className="ui-share-cues">
          {navCues.map((c) => (
            <Button link key={c.label} onClick={c.onClick}>{c.label}</Button>
          ))}
        </div>
      )}
    </div>
  );
}

