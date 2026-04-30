import React from "react";
import { Card } from "./Card";

export function HiddenModal({ open, onClose, items, watchlist, onWish, onHide }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: 14,
        border: "0.5px solid var(--border)",
        padding: 18, maxWidth: 720, width: "100%", maxHeight: "80vh",
        overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text1)" }}>
            Hidden listings · {items.length}
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 22, lineHeight: 1, padding: 4 }}>
            ×
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14 }}>
          Items you've hidden from the Available feed. Tap × on any to restore it.
        </div>
        {items.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
            Nothing hidden.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {items.map(item => (
              <Card
                key={item.id}
                item={item}
                wished={!!watchlist[item.id]}
                onWish={onWish}
                compact={true}
                onHide={onHide}
                isHidden={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
