import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Modal, ModalNote, ModalFoot, Button } from "../ui";

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
      // Escape is the Modal's own (it calls handleCancel); Enter confirms.
      if (e.key === "Enter") handleConfirm();
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
    <Modal title={title || "Are you sure?"} ariaLabel={title || "Confirm"} onClose={handleCancel} width={440}>
      {message ? <ModalNote>{message}</ModalNote> : null}
      <ModalFoot>
        <Button small onClick={handleCancel}>{cancelLabel}</Button>
        <Button small primary={tone !== "danger"} danger={tone === "danger"} autoFocus onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </ModalFoot>
    </Modal>
  );

  return createPortal(overlay, document.body);
}
