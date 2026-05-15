import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { modalBackdrop, modalShell, actionButton } from "../styles";

// Imperative-API styled confirm dialog. Replaces window.confirm
// across the app so confirmations match the rest of the UI in light/
// dark mode and pick up the brand/danger tokens.
//
// Usage:
//   import { confirm } from "./ConfirmModal";
//   if (!(await confirm({ title: "Delete?", tone: "danger" }))) return;
//
// One <ConfirmHost/> mounts at the top of the app (both shells).
// confirm() pushes a request through a module-level setter; the host
// renders the modal and resolves the promise when the user picks.

let pushRequest = null;

export function confirm(opts) {
  return new Promise((resolve) => {
    if (typeof pushRequest !== "function") {
      // Fall back to window.confirm if the host hasn't mounted yet
      // (e.g. server-render or pre-hydration). Should never happen
      // in practice once App mounts.
      const ok = typeof window !== "undefined"
        ? window.confirm(opts?.message || opts?.title || "Are you sure?")
        : false;
      resolve(ok);
      return;
    }
    pushRequest({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);

  useEffect(() => {
    pushRequest = setReq;
    return () => { pushRequest = null; };
  }, []);

  const handleCancel = useCallback(() => {
    if (!req) return;
    req.resolve(false);
    setReq(null);
  }, [req]);

  const handleConfirm = useCallback(() => {
    if (!req) return;
    req.resolve(true);
    setReq(null);
  }, [req]);

  useEffect(() => {
    if (!req) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") handleCancel();
      else if (e.key === "Enter") handleConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [req, handleCancel, handleConfirm]);

  if (typeof document === "undefined" || !req) return null;

  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "default",
  } = req;

  const overlay = (
    <div
      style={modalBackdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "confirm-modal-title" : undefined}
    >
      <div style={{ ...modalShell, maxWidth: 420 }}>
        {title && (
          <h2 id="confirm-modal-title" style={{
            margin: "0 0 8px",
            fontSize: 16, fontWeight: 600,
            color: "var(--text1)",
            letterSpacing: "-0.005em",
          }}>
            {title}
          </h2>
        )}
        {message && (
          <p style={{
            margin: title ? "0 0 18px" : "0 0 18px",
            fontSize: 13, lineHeight: 1.5,
            color: "var(--text2)",
          }}>
            {message}
          </p>
        )}
        <div style={{
          display: "flex", justifyContent: "flex-end",
          gap: 8, marginTop: 4,
        }}>
          <button onClick={handleCancel} style={actionButton({ variant: "subtle" })}>
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            autoFocus
            style={actionButton({ variant: tone === "danger" ? "danger" : "primary" })}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
