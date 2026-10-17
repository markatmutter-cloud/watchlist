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

import React, { useLayoutEffect, useRef } from "react";
import { HeartIcon } from "../components/icons";
import "./ui.css";

export { PageShell, HeaderSearch } from "./PageShell";
export { SearchField, SuggestionRows } from "./SearchField";

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
export function Pill({ on, icon, n, quiet, toggle, children, className, href, ...rest }) {
  const iconOnly = !!icon && !children;
  const cls = cx("ui-pill", on && "is-on", quiet && "ui-pill--quiet", iconOnly && "ui-pill--icon", className);
  const inner = (
    <>
      {icon || null}
      {children}
      {n ? <span className="ui-pill-n">· {n}</span> : null}
    </>
  );
  // A pill that goes somewhere else (the auction house's own page) is a link, same look.
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer" {...rest}>{inner}</a>;
  return (
    <button type="button" className={cls} aria-pressed={toggle ? !!on : undefined} {...rest}>{inner}</button>
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

// ---- Chip / ChipPanel: the options behind a pill (sources, brands, models) ----------
//   on     selected (solid olive)    n   a count after the label    quiet   "× Clear", "+36 more"
export function Chip({ on, n, quiet, children, className, ...rest }) {
  return (
    <button type="button" className={cx("ui-chip", on && "is-on", quiet && "ui-chip--quiet", className)} {...rest}>
      {children}
      {n !== undefined && n !== null ? <span className="ui-chip-n">{n}</span> : null}
    </button>
  );
}
export function ChipPanel({ children }) {
  return <div className="ui-panel">{children}</div>;
}

// ---- PriceRange: $ min – max, inline (desktop; the phone has it in the filter sheet) --
export function PriceRange({ min, max, onMin, onMax, onClear }) {
  return (
    <div className="ui-price">
      <span>$</span>
      <input value={min} onChange={(e) => onMin(e.target.value)} placeholder="Min" inputMode="numeric" aria-label="Minimum price USD" />
      <span>–</span>
      <input value={max} onChange={(e) => onMax(e.target.value)} placeholder="Max" inputMode="numeric" aria-label="Maximum price USD" />
      {(min || max) && onClear ? (
        <button type="button" aria-label="Clear price filter" onClick={onClear}>&times;</button>
      ) : null}
    </div>
  );
}

// ---- Button: the sheet's actions ("Show 12 watches", "Reset") ------------------------
export function Button({ primary, children, className, ...rest }) {
  return (
    <button type="button" className={cx("ui-btn", primary ? "ui-btn--primary" : "ui-btn--ghost", className)} {...rest}>
      {children}
    </button>
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

// ---- FilterBar: pills left · search centred · count right -----------------------------
//   panel    the open options panel (ChipPanel), kept INSIDE the sticky zone
//   sticky   pin under the header while the page scrolls
//   stacked  search on its own row above the pills, at any width: for a bar that carries
//            too much for one line (the auction catalog: calendar, source, brand, price,
//            sort, count AND its own search)
//
// A pinned bar publishes where it ends as `--sticky-top` on its page, which is what the
// date dividers, list quick-jump and reference nav already read for "stick just below the
// chrome". Without it they stuck at 0 and hid behind the header and this bar (the old
// shells measured their own chrome; a window-scrolled page has to say so itself).
export function FilterBar({ pills, search, count, end, panel, sticky, stacked }) {
  const zone = useRef(null);
  useLayoutEffect(() => {
    const el = zone.current;
    const page = el && el.closest(".ui-page");
    if (!sticky || !page) return undefined;
    const publish = () => {
      const top = parseFloat(window.getComputedStyle(el).top) || 0;
      page.style.setProperty("--sticky-top", `${Math.round(top + el.offsetHeight)}px`);
    };
    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", publish);
      page.style.removeProperty("--sticky-top");
    };
  }, [sticky]);
  return (
    <div ref={zone} className={cx("ui-filterzone", sticky && "is-sticky")}>
      <div className={cx("ui-filterbar", !search && "ui-filterbar--nosearch", stacked && "ui-filterbar--stacked", !end && "ui-filterbar--endless")}>
        <div className="ui-filterbar-pills">{pills}</div>
        {search ? <div className="ui-filterbar-search">{search}</div> : null}
        <div className="ui-filterbar-end">{end}<Count>{count}</Count></div>
      </div>
      {panel || null}
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
