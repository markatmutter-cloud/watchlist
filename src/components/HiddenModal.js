import React from "react";
import { Card } from "./Card";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

export function HiddenModal({ open, onClose, items, watchlist, onWish, onHide }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell, padding: 18, maxWidth: 720, maxHeight: "80vh", overflowY: "auto",
      }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>
            Hidden listings · {items.length}
          </div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}>×</button>
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
