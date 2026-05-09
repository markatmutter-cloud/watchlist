import { useState, useEffect } from "react";

// Per-device display settings: theme override + column counts.
// Persists mobileCols and desktopCols to localStorage so the choice
// sticks across visits. Theme override (null | true | false) drives
// the dark/light toggle in Settings — null means "follow system".
//
// Extracted from App.js 2026-04-30 (#6 hooks). The legacy localStorage
// keys are preserved to avoid resetting users' saved column choices.

const MOBILE_COLS_KEY  = "dial_mobile_cols";
const DESKTOP_COLS_KEY = "dial_desktop_cols";
const MOBILE_OPTS  = [1, 2, 3];
const DESKTOP_OPTS = [3, 4, 5, 6, 7];

function readMobileCols() {
  // Default 2 on mobile (2026-05-09 — Mark feedback: 3-col was too
  // tight on a 393px iPhone, image overlay buttons collided with
  // each other and the brand chip). Existing users with explicit
  // localStorage preference keep their choice; new users land on 2.
  try {
    const stored = localStorage.getItem(MOBILE_COLS_KEY);
    if (stored == null) return 2;
    const v = parseInt(stored, 10);
    return MOBILE_OPTS.includes(v) ? v : 2;
  } catch { return 2; }
}

function readDesktopCols() {
  try {
    const v = localStorage.getItem(DESKTOP_COLS_KEY);
    if (v === "auto" || v === null) return "auto";
    const n = parseInt(v, 10);
    return DESKTOP_OPTS.includes(n) ? n : "auto";
  } catch { return "auto"; }
}

export function useViewSettings() {
  const [darkOverride, setDarkOverride] = useState(null);
  const [mobileCols, setMobileCols]   = useState(readMobileCols);
  const [desktopCols, setDesktopCols] = useState(readDesktopCols);

  useEffect(() => {
    try { localStorage.setItem(MOBILE_COLS_KEY, String(mobileCols)); } catch {}
  }, [mobileCols]);

  useEffect(() => {
    try { localStorage.setItem(DESKTOP_COLS_KEY, String(desktopCols)); } catch {}
  }, [desktopCols]);

  return {
    darkOverride, setDarkOverride,
    mobileCols, setMobileCols,
    desktopCols, setDesktopCols,
  };
}
