import React, { useState, useEffect } from "react";
import { Modal, ModalLabel, SubTabs, Button } from "../ui";
import { LumeMemorySettings } from "./LumeMemorySettings";

// Settings — cross-device user preferences (currency) plus per-device
// display chrome (theme, column count) and the About entry. Theme +
// columns moved here from the standalone "View" toolbar popover so the
// header stays compact (filter + avatar only).
//
// Per-device fields (theme, columns) write through useViewSettings to
// localStorage. Currency writes through useUserSettings to Supabase.
const CURRENCIES = [
  { code: "USD", label: "USD", symbol: "$" },
  { code: "GBP", label: "GBP", symbol: "£" },
  { code: "EUR", label: "EUR", symbol: "€" },
];

export function SettingsModal({
  open, onClose,
  user,
  displayName, setDisplayName,
  primaryCurrency, setPrimaryCurrency,
  isMobile,
  dark, setDarkOverride,
  mobileCols, setMobileCols,
  desktopCols, setDesktopCols, desktopAutoCols,
  setAboutModalOpen,
}) {
  // Local edit state for the display name. We don't write on every
  // keystroke — that would spam Supabase. Save on blur or on tap of
  // the Save button. Keeps the field reactive to upstream changes
  // (a fresh sign-in or a parallel session edit).
  const [nameDraft, setNameDraft] = useState(displayName || "");
  const [nameStatus, setNameStatus] = useState("");
  useEffect(() => { setNameDraft(displayName || ""); }, [displayName]);

  if (!open) return null;

  const persistName = async () => {
    const trimmed = (nameDraft || "").trim();
    if (!trimmed || trimmed === displayName) {
      setNameDraft(displayName || "");
      return;
    }
    setNameStatus("Saving…");
    const res = await setDisplayName(trimmed);
    setNameStatus(res?.error ? `Didn't save: ${res.error}` : "Saved");
    setTimeout(() => setNameStatus(""), 1800);
  };

  return (
    <Modal title="Settings" onClose={onClose} width={420} sheet>
        {/* Display name — only render for signed-in users. Used on
            shared lists (the who_added chip) and on reactions /
            journal entries. Defaults to your Google name; override
            here if you'd like a different one. */}
        {user && setDisplayName && (
          <>
            <ModalLabel>Display name</ModalLabel>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8, lineHeight: 1.5 }}>
              How you appear to people you share lists with, on attribution chips and journal entries.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={persistName}
                onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } }}
                maxLength={60}
                placeholder="Your name"
                className="ui-input" />
              <Button small primary onClick={persistName}
                disabled={(nameDraft || "").trim() === (displayName || "").trim()}>Save</Button>
            </div>
            {nameStatus && (
              <div style={{ fontSize: 11, color: nameStatus.startsWith("Error") ? "var(--danger)" : "var(--text3)", marginTop: 4 }}>
                {nameStatus}
              </div>
            )}
          </>
        )}

        <ModalLabel>Primary currency</ModalLabel>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, lineHeight: 1.5 }}>
          Listings will show in this currency first, with the dealer's native price below.
          Synced across all your devices.
        </div>
        <SubTabs block choice ariaLabel="Primary currency" activeKey={primaryCurrency} onSelect={setPrimaryCurrency}
          tabs={CURRENCIES.map(c => ({ key: c.code, label: `${c.symbol} ${c.label}` }))} />

        <ModalLabel>Theme</ModalLabel>
        <SubTabs block choice ariaLabel="Theme" activeKey={dark ? "dark" : "light"}
          onSelect={(k) => setDarkOverride(k === "dark")}
          tabs={[{ key: "light", label: "Light" }, { key: "dark", label: "Dark" }]} />

        <ModalLabel>Columns</ModalLabel>
        {isMobile ? (
          <SubTabs block choice ariaLabel="Columns" activeKey={mobileCols} onSelect={setMobileCols}
            tabs={[1, 2, 3].map(n => ({ key: n, label: String(n) }))} />
        ) : (
          <>
            <SubTabs block choice ariaLabel="Columns" activeKey={desktopCols} onSelect={setDesktopCols}
              tabs={["auto", 3, 4, 5, 6, 7].map(n => ({ key: n, label: n === "auto" ? "Auto" : String(n) }))} />
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
              Auto = {desktopAutoCols} columns at this width.
            </div>
          </>
        )}

        <LumeMemorySettings />

        <div style={{ marginTop: 20 }}>
          <Button block small onClick={() => { onClose(); setAboutModalOpen(true); }}>About Watchlist</Button>
        </div>
    </Modal>
  );
}
