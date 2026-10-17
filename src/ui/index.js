// src/ui — the shared page frame. Every page is built from THESE and nothing else
// for pills, search, sub-tabs, titles, counts and the filter bar.
//
// Why (Mark, 2026-10-17: "every page is different ... without chasing leaks"):
// before this, the site had six search fields, pills in eighteen files and a tab
// strip in six, each styled where it was used. Consistency needs ONE definition
// per thing. These are those definitions; the CSS is src/ui/ui.css and the
// approved look is on the live style sheet (`?view=styleguide`).
//
// A page that needs something these don't offer should add a variant HERE and to
// the style sheet — not hand-roll one. ui-guard.test.js fails the build when a
// migrated page does.

import React from "react";
import { HeartIcon } from "../components/icons";
import "./ui.css";

// Join class names, skipping falsy ones.
const cx = (...parts) => parts.filter(Boolean).join(" ");

// ---- Count: "11,288 ARTICLES" -------------------------------------------
export function Count({ children }) {
  return children ? <span className="ui-count">{children}</span> : null;
}

// ---- Pill: a filter / toggle / sort control ---------------------------------
//   on       the selected look: solid olive (Mark, 2026-10-17)
//   icon     a leading icon; with no children it is an icon-only circle
//   n        a count suffix: "Source · 2"
//   quiet    present but quiet ("+36 more")
//   toggle   adds aria-pressed (use for on/off controls, not for menus)
export function Pill({ on, icon, n, quiet, toggle, children, className, ...rest }) {
  const iconOnly = !!icon && !children;
  return (
    <button type="button"
      className={cx("ui-pill", on && "is-on", quiet && "ui-pill--quiet",
                    iconOnly && "ui-pill--icon", className)}
      aria-pressed={toggle ? !!on : undefined}
      {...rest}>
      {icon || null}
      {children}
      {n ? <span className="ui-pill-n">· {n}</span> : null}
    </button>
  );
}

// The Saved heart: a bare icon pill. Never a word, never red (Mark, 2026-10-16).
export function SavedPill({ on, onClick, what = "saved" }) {
  const label = on ? "Show all" : `Show only ${what}`;
  return (
    <Pill on={on} toggle icon={<HeartIcon size={15} filled={!!on} />}
          aria-label={label} title={label} onClick={onClick} />
  );
}

// ---- SearchField: the one search box -----------------------------------------
//   size   "bar" (in the header) | "row" (in a filter bar) | "full" (a phone's own row)
//   trailing   a control seated at the end (the save-this-search heart)
//   children   a suggestions dropdown (<div className="ui-search-drop">)
export function SearchField({ value, onChange, placeholder, ariaLabel, size = "row",
                              inputRef, onFocus, onBlur, onKeyDown, onClear, trailing, children }) {
  return (
    <form className={cx("ui-search", `ui-search--${size}`)} role="search"
          onSubmit={(e) => e.preventDefault()}>
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" />
      </svg>
      <input type="search" ref={inputRef} value={value || ""} onChange={onChange}
             onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown}
             placeholder={placeholder} aria-label={ariaLabel || placeholder} />
      {value && onClear ? (
        <button type="button" className="ui-search-x" aria-label="Clear search" onClick={onClear}>&times;</button>
      ) : null}
      {trailing ? <span className="ui-search-trailing">{trailing}</span> : null}
      {children}
    </form>
  );
}

// ---- SubTabs: "where you are" ------------------------------------------------------
//   Segmented only: one track, a solid olive active chip (Mark, 2026-10-17).
//   tabs      [{ key, label, ariaLabel? }]   (ariaLabel for an icon-only tab)
export function SubTabs({ tabs, activeKey, onSelect, ariaLabel }) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={activeKey === t.key}
                aria-label={t.ariaLabel} title={t.ariaLabel}
                className={activeKey === t.key ? "is-on" : undefined}
                onClick={() => onSelect && onSelect(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---- FilterBar: pills left · search centred · count right ----------------------------
export function FilterBar({ pills, search, count, end }) {
  return (
    <div className={cx("ui-filterbar", !search && "ui-filterbar--nosearch")}>
      <div className="ui-filterbar-pills">{pills}</div>
      {search ? <div className="ui-filterbar-search">{search}</div> : null}
      <div className="ui-filterbar-end">{end}<Count>{count}</Count></div>
    </div>
  );
}

// ---- AccountDisc: the account control, one look everywhere ----------------------
export function AccountDisc({ initial, onClick, ...rest }) {
  return (
    <button type="button" className="ui-disc" aria-label="Account menu" title="Account menu"
            onClick={onClick} {...rest}>{initial}</button>
  );
}

// ---- SuggestionRows: saved searches / recent searches under a focused field ---------
//   rows   [{ id, label, meta }]   onRun(row)   onRemove(row) (optional ×)
export function SuggestionRows({ heading, rows, onRun, onRemove }) {
  if (!rows || rows.length === 0) return null;
  return (
    <>
      {heading ? <p className="ui-drop-head">{heading}</p> : null}
      {rows.map((r) => (
        <div key={r.id} className="ui-drop-row">
          <button type="button" className="ui-drop-main" onClick={() => onRun && onRun(r)}>
            <span className="ui-drop-label">{r.label}</span>
            {r.meta ? <span className="ui-drop-meta">{r.meta}</span> : null}
          </button>
          {onRemove ? (
            <button type="button" className="ui-drop-x" aria-label={`Remove ${r.label}`} title="Remove"
                    onClick={() => onRemove(r)}>&times;</button>
          ) : null}
        </div>
      ))}
    </>
  );
}

// ---- PageFrame: the anatomy of every page below the header ---------------------------
//   sub-tabs → filter bar → content, in that order, at one inset. No page title
//   (Mark, 2026-10-17): the header's active tab already says where you are.
//   Each band is optional; none can be reordered, which is the point.
export function PageFrame({ subTabs, subTabsEnd, filterBar, children }) {
  return (
    <div className="ui-frame">
      <div className="ui-frame-in">
        {subTabs ? (
          <div className="ui-tabs-row">{subTabs}{subTabsEnd || null}</div>
        ) : null}
        {filterBar || null}
        <div className="ui-content">{children}</div>
      </div>
    </div>
  );
}
