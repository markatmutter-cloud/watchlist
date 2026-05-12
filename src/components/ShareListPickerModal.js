import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "./EmptyState";

// Send-flow entry point from the Share tab (Mark feedback 2026-05-12:
// "there's no way to instigate a share process from the share tab").
// Lists the user's owned non-system non-challenge non-inbox lists;
// tapping a row builds the public list URL + fires the native share
// sheet (or clipboard fallback). Read-only by default — collaborator
// invites stay at the list drill-in's Manage sheet.
//
// Future iterations:
//   - Permission picker (view vs. react vs. collaborate)
//   - Recipient picker (email / contact / direct-link tabs)
//   - Poll mode selector (one-shot link vs. counted vote)

export function ShareListPickerModal({
  open,
  onClose,
  myLists,         // [{ id, name, count }]
  onShareLink,     // (listId) => Promise<{ copied?: boolean }>
  onOpenList,      // (listId) => void  — navigate to drill-in (for Manage)
}) {
  const [feedback, setFeedback] = useState(null);  // { listId, message }

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 1800);
    return () => clearTimeout(t);
  }, [feedback]);

  // ESC to close.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleShare = async (listId) => {
    try {
      const res = await onShareLink?.(listId);
      if (res?.copied) setFeedback({ listId, message: "Link copied — paste anywhere" });
    } catch (e) {
      setFeedback({ listId, message: "Couldn't share — try again" });
    }
  };

  const overlay = (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2100,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          width: "100%", maxWidth: 520,
          maxHeight: "85vh",
          borderRadius: "16px 16px 0 0",
          display: "flex", flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>
        {/* Header */}
        <div style={{
          padding: "8px 20px 12px",
          borderBottom: "0.5px solid var(--border)",
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text1)", marginBottom: 2 }}>
              Share a list
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              Pick a list to send. The link opens the list in read-only mode for
              anyone who has it.
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text3)", fontFamily: "inherit",
              fontSize: 20, padding: 0, lineHeight: 1, marginLeft: 12,
            }}>×</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 20px" }}>
          {myLists.length === 0 ? (
            <EmptyState
              icon="📋"
              heading="No lists yet"
              blurb={<>Create a list under <strong>Watchlists › Lists</strong> first — then come back here to share it.</>}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myLists.map(c => {
                const isFeedback = feedback?.listId === c.id;
                return (
                  <div key={c.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "0.5px solid var(--border)",
                    background: "var(--surface)",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                        {isFeedback ? feedback.message : `${c.count} watch${c.count === 1 ? "" : "es"}`}
                      </div>
                    </div>
                    <button onClick={() => onOpenList?.(c.id)}
                      title="Open list — Manage collaborators from there"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "0.5px solid var(--border)",
                        background: "var(--surface)", color: "var(--text1)",
                        cursor: "pointer", fontFamily: "inherit",
                        fontSize: 12, fontWeight: 500, flexShrink: 0,
                      }}>Open</button>
                    <button onClick={() => handleShare(c.id)}
                      title="Share link via the native share sheet"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--brand)", color: "#fff",
                        cursor: "pointer", fontFamily: "inherit",
                        fontSize: 12, fontWeight: 600, flexShrink: 0,
                      }}>
                      {isFeedback ? "✓ Sent" : "Share"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
