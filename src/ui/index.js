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

import React, { forwardRef, useEffect, useLayoutEffect, useRef } from "react";
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
//   primary  solid olive for the one main action in a group ("+ From feed"); not a selected state
//   href     the pill is a link that opens elsewhere
//   as       "span": the look only, for use inside something already clickable
export function Pill({ on, primary, icon, n, quiet, toggle, children, className, href, as, ...rest }) {
  const iconOnly = !!icon && !children;
  const cls = cx("ui-pill", (on || primary) && "is-on", quiet && "ui-pill--quiet", iconOnly && "ui-pill--icon", className);
  const inner = (
    <>
      {icon || null}
      {children}
      {n ? <span className="ui-pill-n">· {n}</span> : null}
    </>
  );
  // A pill that goes somewhere else (the auction house's own page) is a link, same look.
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer" {...rest}>{inner}</a>;
  // Inside something that is already a link or button (a card's "View listing →"): the look without a second control.
  if (as === "span") return <span className={cls} {...rest}>{inner}</span>;
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

// ---- Button: an action in a sheet, a modal or an empty state ("Show 12 watches", "Save") ------
//   primary  the one main action: solid olive (the same olive as "on" everywhere)
//   danger   a destructive confirm: solid danger
//   small    the modal-footer size
//   inline   sized to its label instead of growing to fill a row (a sign-in button in an empty state)
//   block    the full width of its container, content centred (a modal's "Continue with Google")
//   link     no box at all: a text action in the page's flow ("View all →", "← Back")
//   muted    with link: quiet grey and small, for a footer
//   href     renders an anchor with the same look (a footer's Privacy / Terms)
export function Button({ primary, danger, small, inline, block, link, muted, href, children, className, ...rest }) {
  const kind = link ? "ui-btn--link" : danger ? "ui-btn--danger" : primary ? "ui-btn--primary" : "ui-btn--ghost";
  const cls = cx("ui-btn", kind, link && danger && "ui-btn--link-danger", small && "ui-btn--sm", inline && "ui-btn--inline", block && "ui-btn--block", muted && "ui-btn--muted", className);
  if (href) return <a className={cls} href={href} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

// ---- Input / Textarea: the one form field --------------------------------------------------
export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx("ui-input", className)} {...rest} />;
});
export const Textarea = forwardRef(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx("ui-input ui-input--area", className)} {...rest} />;
});

// ---- Modal: a dialog over the page --------------------------------------------------------------
//   title     the heading (a Bodoni name, like a section head), with the × beside it
//   onClose   the × / the scrim / Escape. `locked` turns the scrim and Escape off (while saving)
//   width     max width in px (default 440)
//   sheet     flush layout: a pinned head, and the body scrolls (Settings, a watch's details)
//   full      the sheet fills a phone screen
//   bare      no head at all, for a modal that lays itself out (About)
//   top       align to the top on a phone (About)
//   headAction  replaces the x in the head (the list picker's Done: its toggles are live, so Done is the close)
export function Modal({ title, onClose, width = 440, locked, sheet, full, bare, top, headAction, ariaLabel, className, children }) {
  useEffect(() => {
    if (!onClose || locked) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, locked]);
  return (
    <div className={cx("ui-modal-scrim", top && "ui-modal-scrim--top", full && "ui-modal-scrim--full")}
         onClick={locked ? undefined : onClose}>
      <div className={cx("ui-modal", sheet && "ui-modal--sheet", full && "ui-modal--full", bare && "ui-modal--bare", className)}
           style={{ "--ui-modal-w": `${width}px` }}
           role="dialog" aria-modal="true" aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
           onClick={(e) => e.stopPropagation()}>
        {bare ? children : (
          <>
            <div className="ui-modal-head">
              <h2 className="ui-modal-title">{title}</h2>
              {headAction || <ModalClose onClose={onClose} />}
            </div>
            {sheet ? <div className="ui-modal-body">{children}</div> : children}
          </>
        )}
      </div>
    </div>
  );
}
export function ModalClose({ onClose, float }) {
  return (
    <button type="button" className={cx("ui-modal-x", float && "ui-modal-x--float")} aria-label="Close" onClick={onClose}>&times;</button>
  );
}
//   ModalNote: the quiet line under a title.  ModalFoot: the right-aligned row of actions.
export function FieldLabel({ children }) { return <div className="ui-field-label">{children}</div>; }
export function ModalLabel({ children }) { return <div className="ui-modal-label">{children}</div>; }
export function ModalNote({ children }) { return <p className="ui-modal-note">{children}</p>; }
export function ModalError({ children }) { return children ? <p className="ui-modal-error" role="alert">{children}</p> : null; }
export function ModalFoot({ children }) { return <div className="ui-modal-foot">{children}</div>; }

// ---- SubTabs: "where you are" ------------------------------------------------------
//   Segmented only: one track, a solid olive active chip (Mark, 2026-10-17).
//   tabs      [{ key, label, ariaLabel? }]   (ariaLabel for an icon-only tab)
//   block     fills its container, the options sharing the width (a choice in a settings dialog)
//   choice    announced as a radio group (picking a setting) rather than tabs (views of a page)
export function SubTabs({ tabs, activeKey, onSelect, ariaLabel, block, choice }) {
  // `choice`: the same segmented look for picking ONE setting (currency, theme), announced as a
  // radio group rather than as views of a page.
  const group = choice ? "radiogroup" : "tablist";
  return (
    <div className={cx("ui-tabs", block && "ui-tabs--block")} role={group} aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role={choice ? "radio" : "tab"}
                aria-selected={choice ? undefined : activeKey === t.key}
                aria-checked={choice ? activeKey === t.key : undefined}
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

// ---- PickRow: one row in a "choose from a list" dialog ---------------------------------------
//   meta     the quiet text at the right ("3 items")
//   checked  undefined for a plain pick (saves on tap); true / false for a live toggle (shows a box)
export function PickRow({ children, meta, checked, className, ...rest }) {
  return (
    <button type="button" className={cx("ui-pickrow", checked && "is-on", className)}
            aria-pressed={checked === undefined ? undefined : !!checked} {...rest}>
      <span className="ui-pickrow-main">
        {checked === undefined ? null : (
          <span className="ui-pickrow-box" aria-hidden="true">{checked ? "✓" : ""}</span>
        )}
        <span className="ui-pickrow-name">{children}</span>
      </span>
      {meta ? <span className="ui-pickrow-meta">{meta}</span> : null}
    </button>
  );
}

// ---- DismissChip: a selected filter you can take off ("Rolex ×") ------------------------
export function DismissChip({ children, onRemove, label }) {
  return (
    <span className="ui-dismiss">
      <span>{children}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${label || children}`}>&times;</button>
    </span>
  );
}

// ---- JumpNav: a sticky row of pills that scroll to a section of a long page -------------
//   items   [{ key, label }]   activeKey (optional)   onGo(key)
export function JumpNav({ items, activeKey, onGo, ariaLabel }) {
  return (
    <nav className="ui-jumpnav" aria-label={ariaLabel}>
      {items.map((it) => (
        <Pill key={it.key} on={activeKey === it.key} onClick={() => onGo(it.key)}>{it.label}</Pill>
      ))}
    </nav>
  );
}

// ---- SectionHead: the heading INSIDE a page's content (a list's name and its actions) -------
//   Not a page title (the header's active tab says where you are); this names a thing on the
//   page. title is optional: with none it is just the row of actions and the count.
//   actions  [{ label, onClick, href, icon, active, ariaLabel, primary }]   rendered as Pills
//   onExit   shows a quiet "← {exitLabel}" pill above the title
export function SectionHead({ eyebrow, title, meta, count, actions = [], onExit, exitLabel = "Back", trailing }) {
  return (
    <div className="ui-sechead">
      {onExit ? (
        <div className="ui-sechead-back">
          <Pill quiet onClick={onExit}>← {exitLabel}</Pill>
        </div>
      ) : null}
      {eyebrow ? <div className="ui-sechead-eyebrow">{eyebrow}</div> : null}
      <div className="ui-sechead-row">
        {title ? <h2 className="ui-sechead-title">{title}</h2> : null}
        {(actions.length > 0 || trailing || count) ? (
          <div className="ui-sechead-end">
            {actions.map((a) => (
              <Pill key={a.label} href={a.href} icon={a.icon} on={!!a.active} primary={!!a.primary}
                    aria-label={a.ariaLabel} onClick={a.onClick}>{a.label}</Pill>
            ))}
            {trailing || null}
            <Count>{count}</Count>
          </div>
        ) : null}
      </div>
      {meta ? <div className="ui-sechead-meta">{meta}</div> : null}
    </div>
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
