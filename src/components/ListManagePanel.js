import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// List management panel — Mark spec 2026-05-14. Replaces the single
// "⋯" overflow menu on the Lists drill-in header with a sectioned
// panel that hosts every list-level action in one place: Screening,
// View, Share, Collaboration, List. Portal'd to document.body so
// stacking-context ancestors in CollectionsTab can't trap it (same
// pattern as WatchDetailSheet). Desktop renders as a right-side
// panel (≥900px); mobile as a bottom sheet.

const SANS_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function ListManagePanel({
  open,
  onClose,
  isWide,
  myReactionsCount,
  unreviewedCount,
  // View state (persisted in parent via localStorage)
  viewMode, // "buckets" | "flat"
  onViewModeChange,
  // Action handlers — undefined means "don't show this row"
  onStartScreening, // shown only when isRecipient
  onResetReactions, // shown only when myReactionsCount > 0
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const backdrop = {
    position: "fixed",
    inset: 0,
    zIndex: 2500,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: isWide ? "stretch" : "flex-end",
    justifyContent: isWide ? "flex-end" : "center",
  };

  const panelStyle = {
    background: "var(--bg)",
    color: "var(--text1)",
    fontFamily: SANS_STACK,
    width: isWide ? 380 : "100%",
    maxWidth: isWide ? 380 : 640,
    height: isWide ? "100%" : "auto",
    maxHeight: isWide ? "100%" : "85vh",
    overflowY: "auto",
    borderTopLeftRadius: isWide ? 0 : 16,
    borderTopRightRadius: isWide ? 0 : 16,
    borderLeft: isWide ? "0.5px solid var(--border)" : "none",
    boxShadow: isWide
      ? "-8px 0 24px rgba(0,0,0,0.18)"
      : "0 -8px 24px rgba(0,0,0,0.18)",
    paddingBottom: isWide ? 24 : "calc(env(safe-area-inset-bottom, 0px) + 24px)",
  };

  const stopDown = (e) => e.stopPropagation();

  return createPortal(
    <div style={backdrop} onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-label="List settings"
        onMouseDown={stopDown}
        style={panelStyle}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px 12px",
          borderBottom: "0.5px solid var(--border)",
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          zIndex: 1,
        }}>
          <div style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text2)",
          }}>
            Review mode
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text2)",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* SCREENING — only relevant when reactions matter on this list */}
        {(onStartScreening || onResetReactions) && (
          <Section title="Screening">
            {onStartScreening && (
              <Row
                onClick={onStartScreening}
                primary
                label={unreviewedCount > 0
                  ? `Resume screening · ${unreviewedCount} left`
                  : "Re-screen this list"}
                hint="Walk through watches one at a time"
              />
            )}
            {onResetReactions && (
              <Row
                onClick={onResetReactions}
                label={`Reset my reactions (${myReactionsCount})`}
                hint="Clears your Yes / Pass ratings on this list. Hearts stay where they are."
                danger
              />
            )}
          </Section>
        )}

        {/* VIEW — Mark spec 2026-05-14: per-bucket visibility
            checkboxes retired ("don't think buckets is a good one
            to have on off checks for"). Show-as Buckets/Flat stays
            as the single escape hatch. Future view options here:
            see-others-reactions toggle, sort by Mine / By group /
            By person. */}
        <Section title="View">
          <SegmentedRow
            label="Show as"
            value={viewMode}
            options={[
              { value: "buckets", label: "Buckets" },
              { value: "flat", label: "Flat list" },
            ]}
            onChange={onViewModeChange}
          />
        </Section>

        {/* SHARE / COLLABORATION / LIST sections removed 2026-05-14
            (Mark spec): everything social moved to the header Share
            dropdown; Rename / Delete moved to the list-row actions
            on the list-of-lists view. This panel is now scoped to
            reactions + view settings only. */}
      </div>
    </div>,
    document.body
  );
}

function Section({ title, children }) {
  return (
    <div style={{ padding: "10px 0 4px" }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: "var(--text3)",
        padding: "8px 18px 4px",
      }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, hint, onClick, danger, primary, disabled }) {
  const color = disabled
    ? "var(--text3)"
    : danger
    ? "var(--danger, #c0392b)"
    : "var(--text1)";
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={!!disabled}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        padding: "10px 18px",
        cursor: disabled ? "default" : "pointer",
        color,
        fontFamily: "inherit",
      }}
    >
      <div style={{
        fontSize: 14,
        fontWeight: primary ? 600 : 500,
      }}>
        {label}
      </div>
      {hint && (
        <div style={{
          fontSize: 12,
          color: "var(--text3)",
          marginTop: 2,
        }}>
          {hint}
        </div>
      )}
    </button>
  );
}

function SegmentedRow({ label, value, options, onChange }) {
  return (
    <div style={{ padding: "12px 18px 6px" }}>
      <div style={{
        fontSize: 11,
        color: "var(--text3)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        display: "inline-flex",
        border: "0.5px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: "6px 14px",
                background: active ? "var(--brand)" : "transparent",
                color: active ? "#fff" : "var(--text1)",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
