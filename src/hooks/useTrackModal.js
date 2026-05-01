import { useState, useCallback } from "react";

// State + submit handler for the Track-new-item modal. Owns the URL
// input, busy/error flags, and the submit flow that calls the parent's
// addTrackedLot. Extracted from App.js 2026-04-30 (recommendation #6 —
// hooks file for state shape).
//
// Internal field names (open/url/busy/error/setOpen/setUrl/...) are
// what the hook *returns*. The TrackNewItemModal component still
// accepts the older trackUrl/trackError naming on its props — App.js
// maps between the two when rendering the modal.
export function useTrackModal({ addTrackedLot }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(async () => {
    if (!url.trim() || !addTrackedLot) return;
    setBusy(true);
    setError("");
    const { error: err } = await addTrackedLot(url);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setUrl("");
      setOpen(false);
    }
  }, [url, addTrackedLot]);

  return { open, setOpen, url, setUrl, busy, error, setError, submit };
}
