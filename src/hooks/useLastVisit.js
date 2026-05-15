import { useState, useEffect, useMemo, useCallback } from "react";

// Tracks the timestamp of the user's PREVIOUS visit so the new-
// listings screening flow (Mark spec 2026-05-14) can compute "what
// landed since you last opened Watchlist." On mount, reads the
// stored `dial_last_visit_ts` from localStorage and then bumps it
// to NOW so the next session's `lastVisit` is this session's open.
// Returns { lastVisit, newSince, markSeen }:
//
//   lastVisit  — Date (or null on first-ever visit). Reflects the
//                PREVIOUS session's open timestamp, not this one's.
//   newSince(items, limit=50) — given the listings feed, returns
//                items with `firstSeen > lastVisit`, capped at
//                `limit`. Caps so an away-for-three-weeks user
//                doesn't face 200 cards.
//   markSeen() — explicit "I've reviewed everything" call. Bumps
//                the stored timestamp to NOW so the banner clears
//                without waiting for a fresh session.
//
// Storage key chosen to match the existing dial_* pattern. Don't
// bump or rename — first-ever visitors get null lastVisit and see
// no "new since…" banner (the feed itself is their first impression).

const LAST_VISIT_KEY = "dial_last_visit_ts";

function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_VISIT_KEY);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    return new Date(ts);
  } catch {
    return null;
  }
}

function writeStored(ts) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LAST_VISIT_KEY, String(ts)); }
  catch {/* private mode / full quota — silent */}
}

export function useLastVisit() {
  // `lastVisit` is the timestamp from the PREVIOUS session — frozen
  // at mount so it doesn't drift as the user spends time in the app.
  const [lastVisit, setLastVisit] = useState(() => readStored());

  useEffect(() => {
    // Bump the stored timestamp to NOW so next session sees this
    // session's open as its lastVisit.
    writeStored(Date.now());
    // Intentionally NOT updating state — `lastVisit` stays frozen
    // for the duration of this session.
  }, []);

  const newSince = useCallback((items, limit = 50) => {
    if (!Array.isArray(items)) return [];
    if (!lastVisit) return []; // first-ever visit — no diff to show
    const cutoff = lastVisit.getTime();
    const out = [];
    for (const it of items) {
      const fs = it?.firstSeen ? new Date(it.firstSeen).getTime() : 0;
      if (fs > cutoff) out.push(it);
      if (out.length >= limit) break;
    }
    return out;
  }, [lastVisit]);

  const markSeen = useCallback(() => {
    const now = Date.now();
    writeStored(now);
    setLastVisit(new Date(now));
  }, []);

  return useMemo(() => ({ lastVisit, newSince, markSeen }),
                 [lastVisit, newSince, markSeen]);
}
