import { useState, useEffect } from "react";

// Window inner-width tracker. Used to switch between mobile and desktop
// layouts (the breakpoint is hard-coded at 640 in App.js).
export function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// System color-scheme tracker. Returns true when prefers-color-scheme
// is dark. Pairs with a manual override stored in state for the
// theme toggle in the user dropdown.
export function useSystemDark() {
  const [sysDark, setSysDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = e => setSysDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return sysDark;
}
