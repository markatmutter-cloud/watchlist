import { useState, useEffect, useCallback } from "react";

// Home-only hide set. Mark feedback 2026-05-11: the × overlay on
// Home cards should hide the listing FROM HOME ONLY — not from the
// rest of the site, not from other users. (The ⋯ menu Hide entry
// still does the full per-user + global-curation hide.)
//
// Scoped to localStorage so it survives reloads on the same browser
// but doesn't need any DB / sync infrastructure. This is an admin-
// curation tool primarily, and admin uses one or two browsers — full
// cross-device sync is overkill.
//
// The set is opaque IDs (listing.id). The Home slice memos filter
// against it; nothing else in the app reads from it.

const STORAGE_KEY = "dial_home_hidden_v1";

function load() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persist(set) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage full / disabled — fail silently. The state stays
    // in memory for the session.
  }
}

export function useHomeHidden() {
  const [ids, setIds] = useState(() => load());

  // Cross-tab sync: if the user opens Home in two tabs and hides on
  // one, the other should reflect it on next interaction. Cheap.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      setIds(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id) => {
    setIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persist(next);
      return next;
    });
  }, []);

  return { ids, toggle };
}
