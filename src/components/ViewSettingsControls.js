import React from "react";
import { SubTabs, FieldLabel } from "../ui";

// Compact view-settings controls — currency / theme / columns. Lives
// outside SettingsModal so we can render the same fields in an in-flow surface
// (the desktop account menu) without duplicating logic.
//
// User feedback 2026-05-09: the standalone Settings modal hid these behind one
// too many taps. Currency in particular is something you adjust while comparing
// prices — having to leave the filter you're using to swap currencies broke flow.
//
// All three values still write through useViewSettings (per-device, localStorage)
// and useUserSettings (currency, cross-device Supabase). This component is a pure
// render of those getters/setters. Each choice is the shared segmented control
// (SubTabs `choice`), the same one the Settings dialog uses, so the two cannot drift.

const CURRENCIES = [
  { code: "USD", label: "USD", symbol: "$" },
  { code: "GBP", label: "GBP", symbol: "£" },
  { code: "EUR", label: "EUR", symbol: "€" },
];

export function ViewSettingsControls({
  primaryCurrency, setPrimaryCurrency,
  isMobile,
  dark, setDarkOverride,
  mobileCols, setMobileCols,
  desktopCols, setDesktopCols, desktopAutoCols,
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <FieldLabel>Currency</FieldLabel>
        <SubTabs block choice ariaLabel="Currency" activeKey={primaryCurrency} onSelect={setPrimaryCurrency}
          tabs={CURRENCIES.map(c => ({ key: c.code, label: `${c.symbol} ${c.label}` }))} />
      </div>
      <div>
        <FieldLabel>Theme</FieldLabel>
        <SubTabs block choice ariaLabel="Theme" activeKey={dark ? "dark" : "light"}
          onSelect={(k) => setDarkOverride(k === "dark")}
          tabs={[{ key: "light", label: "Light" }, { key: "dark", label: "Dark" }]} />
      </div>
      <div>
        <FieldLabel>Columns</FieldLabel>
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
      </div>
    </div>
  );
}
