// SearchField + SuggestionRows: the one search box and the rows under it. Their own module so the
// Home masthead can use them without importing the whole of src/ui (which imports the header,
// which imports the masthead).

import React from "react";
import "./ui.css";

const cx = (...parts) => parts.filter(Boolean).join(" ");

// ---- SearchField: the one search box -----------------------------------------
//   size   "bar" (in the header) | "row" (in a filter bar) | "full" (a phone's own row)
//   trailing   a control seated at the end (the save-this-search heart, Home's Search button)
//   onSubmit   called on Enter / the trailing submit button (the default is to do nothing)
//   children   a suggestions dropdown (<div className="ui-search-drop">)
export function SearchField({ value, onChange, placeholder, ariaLabel, size = "row",
                              inputRef, onFocus, onBlur, onKeyDown, onClear, onSubmit, trailing, children }) {
  return (
    <form className={cx("ui-search", `ui-search--${size}`)} role="search"
          onSubmit={(e) => { e.preventDefault(); if (onSubmit) onSubmit(e); }}>
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

