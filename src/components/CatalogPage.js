// CatalogPage — one auction sale as a full page (Mark, 2026-06-13: "the auction catalog is a
// FULL-PAGE surface"), built from src/ui. The page's header is the olive title bar plus a quiet
// row of actions (Save catalog, Share, Auction house) instead of the tab header, and a × that
// goes back to the calendar it was opened from. Below it: the shared filter bar (with its own
// search, since there is no header search here) and the lot grid App already builds.

import React from "react";
import { PageShell, PageFrame, Pill } from "../ui";
import { ListingsSearch, ListingsFilterBar, ListingsFilterSheet } from "./ListingsFilters";

export default function CatalogPage(props) {
  const { sale, saleDates, onExit, actions, displayedCount, gridJSX } = props;
  const eyebrow = [sale.house, sale.location, saleDates].filter(Boolean).join(" · ");
  const f = props;
  return (
    <PageShell
      {...props}
      header={
        <>
          <div className="ui-takeover">
            <div className="ui-takeover-text">
              <div className="ui-takeover-eyebrow">{eyebrow}</div>
              <div className="ui-takeover-title">{sale.title}</div>
            </div>
            <button type="button" className="ui-takeover-x" onClick={onExit}
                    aria-label="Back to auction calendar" title="Back to auction calendar">×</button>
          </div>
          {actions.length > 0 ? (
            <div className="ui-takeover-acts">
              {actions.map((a, i) => (
                <Pill key={i} href={a.href} icon={a.icon} onClick={a.onClick} on={!!a.active}>{a.label}</Pill>
              ))}
            </div>
          ) : null}
        </>
      }>
      <PageFrame
        filterBar={
          <ListingsFilterBar {...f} stacked
            searchSlot={<ListingsSearch {...f} size="row" />}
            count={`${(displayedCount || 0).toLocaleString()} ${displayedCount === 1 ? "watch" : "watches"}`} />
        }>
        {gridJSX}
      </PageFrame>
      <ListingsFilterSheet {...f} />
    </PageShell>
  );
}
