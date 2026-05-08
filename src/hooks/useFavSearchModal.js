import { useState, useCallback } from "react";

// State + open/submit handlers for the Save-search ("favorite search")
// modal. The query comes from the live search input — this hook only
// owns the label being typed plus the open flag. Submit calls the
// parent's quickAddSearch with (label, query). Extracted from App.js
// 2026-04-30 (recommendation #6).
//
// `search` is reactive — the prompt pre-fills with the current search
// value when opened, so the hook needs the current search at open time
// (not at hook-call time). Pass it via the `search` parameter every
// render — the useCallback dep keeps the closures fresh.
//
// 2026-05-08 — Mark feedback: also pass `minPriceText` / `maxPriceText`
// so the search-bar heart captures the active price guard alongside
// the query. Either / both empty = no price filter persisted.
export function useFavSearchModal({ search, minPriceText, maxPriceText, quickAddSearch }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const openPrompt = useCallback(() => {
    setLabel((search || "").trim());
    setError("");
    setOpen(true);
  }, [search]);

  const submit = useCallback(async () => {
    const { error: err } = await quickAddSearch(label, search, {
      minPrice: minPriceText,
      maxPrice: maxPriceText,
    });
    if (err) {
      setError(err);
      return;
    }
    setOpen(false);
    setLabel("");
  }, [label, search, minPriceText, maxPriceText, quickAddSearch]);

  return { open, setOpen, label, setLabel, error, setError, openPrompt, submit };
}
