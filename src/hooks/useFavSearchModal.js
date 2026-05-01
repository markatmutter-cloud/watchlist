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
export function useFavSearchModal({ search, quickAddSearch }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const openPrompt = useCallback(() => {
    setLabel((search || "").trim());
    setError("");
    setOpen(true);
  }, [search]);

  const submit = useCallback(async () => {
    const { error: err } = await quickAddSearch(label, search);
    if (err) {
      setError(err);
      return;
    }
    setOpen(false);
    setLabel("");
  }, [label, search, quickAddSearch]);

  return { open, setOpen, label, setLabel, error, setError, openPrompt, submit };
}
