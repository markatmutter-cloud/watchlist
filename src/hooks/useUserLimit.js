import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// User-specific watchlist cap (Epic 3 — User limits). Reads
// public.user_limits.watchlist_cap for the signed-in user, falling
// back to the system default (2500) if no row exists.
//
// The DB also enforces this via a BEFORE INSERT trigger on
// watchlist_items, so the frontend cap is purely UX — the trigger
// is the line of defense if a malicious or buggy client bypasses
// the JS check.
//
// Default mirrors the SQL `default_watchlist_cap()` function. If
// the system-wide default ever changes, both should bump together.

export const DEFAULT_WATCHLIST_CAP = 2500;
// Soft-warn threshold — banner appears when the user reaches 80%
// of their cap so they have time to react before hitting the wall.
export const SOFT_WARN_THRESHOLD = 0.8;

export function useUserLimit(user, watchlistCount) {
  const [cap, setCap] = useState(DEFAULT_WATCHLIST_CAP);

  useEffect(() => {
    if (!user || !supabase) return undefined;
    let cancelled = false;
    supabase
      .from("user_limits")
      .select("watchlist_cap")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return;  // RLS denial / no row / network blip — keep default
        if (data?.watchlist_cap) setCap(data.watchlist_cap);
      });
    return () => { cancelled = true; };
  }, [user]);

  const count = typeof watchlistCount === "number" ? watchlistCount : 0;
  const isAtSoftWarn = count >= Math.floor(cap * SOFT_WARN_THRESHOLD) && count < cap;
  const isAtHardCap = count >= cap;

  return { cap, count, isAtSoftWarn, isAtHardCap };
}
