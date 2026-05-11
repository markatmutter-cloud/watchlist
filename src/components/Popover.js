import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// Portaled popover primitive. Extracted 2026-05-10 from Card.js's
// portalled ⋯ menu — same pattern (click-outside, Escape, position-
// fixed anchored to trigger rect) now lives in one place. Callers:
//   - Card.js's ⋯ menu (per-card actions)
//   - Shared-list drill-in header ⋯ overflow menu
//   - Desktop reaction picker
//
// Two-piece API on purpose: the trigger button is the caller's
// concern (size, icon, aria-label all vary), while the open state +
// anchor math + portal mounting are the primitive's job. Keeps the
// trigger fully customizable without prop-drilling button props.
//
// Usage:
//   const pop = usePopoverState();
//   <button ref={pop.triggerRef} onClick={pop.toggle}>⋯</button>
//   <Popover state={pop}>
//     <button onClick={() => { pop.close(); doX(); }}>Do X</button>
//   </Popover>

export function usePopoverState() {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const triggerRef = useRef(null);

  // Anchor the popover's right edge to the trigger's right edge in
  // viewport coords, top below the trigger. Same math Card.js had
  // inline. Clamp left ≥8 so right-edge cards don't push it off.
  const computeAnchor = useCallback(() => {
    if (!triggerRef.current) return null;
    const r = triggerRef.current.getBoundingClientRect();
    return { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) };
  }, []);

  const toggle = useCallback(() => {
    setOpen(prev => {
      if (!prev) setAnchor(computeAnchor());
      return !prev;
    });
  }, [computeAnchor]);

  const close = useCallback(() => setOpen(false), []);

  return { open, anchor, triggerRef, toggle, close };
}

export function Popover({ state, children }) {
  const portalRef = useRef(null);

  useEffect(() => {
    if (!state.open) return undefined;
    const onDown = (e) => {
      const inTrigger = state.triggerRef.current && state.triggerRef.current.contains(e.target);
      const inPortal  = portalRef.current && portalRef.current.contains(e.target);
      if (!inTrigger && !inPortal) state.close();
    };
    const onKey = (e) => { if (e.key === "Escape") state.close(); };
    // Defer one tick so the click that opened the popover doesn't
    // immediately close it (the same click would otherwise bubble to
    // document and fall through the !inTrigger branch on the way up).
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [state.open, state.triggerRef, state.close]);

  if (typeof document === "undefined") return null;
  if (!state.open || !state.anchor) return null;

  return createPortal(
    <div ref={portalRef} onClick={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: state.anchor.top, right: state.anchor.right,
        zIndex: 1000,
        maxWidth: `calc(100vw - ${state.anchor.right + 16}px)`,
        background: "var(--bg)", border: "0.5px solid var(--border)",
        borderRadius: 8, padding: 4,
        whiteSpace: "nowrap",
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
      }}>
      {children}
    </div>,
    document.body
  );
}
