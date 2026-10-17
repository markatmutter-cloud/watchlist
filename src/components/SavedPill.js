import React from "react";
import { HeartIcon } from "./icons";
import { pillBase } from "../styles";

// SavedPill — the "show only what I saved" toggle in a filter row: a heart
// icon, no word, never red (Mark, 2026-10-16: "I don't like it says saved and
// has a heart icon that goes red. I just like the heart icon").
//
// ONE component for Articles and Reference Guides (the Watches page keeps its
// ♡ Saved sub-tab as the single saved control, since that one spans For sale /
// Auctions / Sold). It is `pillBase`, so the on state is the app's one olive
// selected treatment, and the icon fills with currentColor — olive ink, not
// the --heart red the save buttons on cards use.
//
// This reverses the 2026-07-30 rule that Saved is a sub-tab and never a pill.
// That rule existed because a word-labelled pill looked like every other
// filter and went unfound for months. The icon-only form carries the same
// risk, so the accessible name and title say what it does, and the empty state
// on both surfaces still invites ("Nothing saved yet…").
export function SavedPill({ active, onClick, what = "saved" }) {
  const label = active ? "Show all" : `Show only ${what}`;
  return (
    <button type="button" onClick={onClick}
      aria-pressed={!!active} aria-label={label} title={label}
      style={{ ...pillBase(!!active, { compact: true }),
               display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <HeartIcon size={14} filled={!!active} />
    </button>
  );
}
