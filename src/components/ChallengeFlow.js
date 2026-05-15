import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { fmtUSD, imgSrc } from "../utils";

// Watch Challenges (Build-a-collection v1) — multi-stage flow inside
// Watchlist > Challenges. One collection per challenge with type=
// 'challenge'; state='draft' during stages 1–3, flips to 'complete'
// when the user finishes. Items in the collection split into
// shortlist (is_pick=false) and final picks (is_pick=true) — same
// table, one boolean column per row.
//
// Stages (component-local useState — refresh re-derives from data):
//   create    → set count + budget + title (collection has no
//                target_count yet)
//   picking   → fill slots from shortlist (slots < target_count
//                or any slots empty)
//   reasoning → one-line rationale per pick (slots full)
//   complete  → read-only summary + share (state === 'complete')
//
// Backward navigation via "← back" links. Forward via primary CTA per
// stage. The flow doesn't auto-advance from picking → reasoning when
// the last slot fills; the user explicitly taps "Mark complete".
//
// Picks vs shortlist interaction:
//   desktop  → HTML5 DnD between shortlist tiles and slot cells
//   mobile   → tap a shortlist tile → SlotPickerModal opens with the
//               available slot numbers → tap a slot → place. Same
//               moveToSlot action, two trigger paths.

// ── Stage inference ─────────────────────────────────────────────────
// Source-of-truth for which stage to land on after a refresh. The
// component overrides via setStage when the user explicitly navigates.
function inferStage(challenge, items) {
  if (!challenge) return "create";
  if (challenge.state === "complete") return "complete";
  if (!challenge.targetCount || !challenge.budget) return "create";
  // Picking now owns notes too — there's no separate Reasoning
  // stage. Even when all slots are filled, stay on picking until the
  // user explicitly hits "Mark complete →".
  return "picking";
}

// Container with the standard back-button + title block. Used by
// every stage for visual consistency with the rest of the app.
// 3-stage progression. Reasoning was its own stage in the v1 flow;
// folded back into Picking on 2026-05-06 (notes inline, one less
// step).
const STEPPER_STAGES = [
  { key: "create",   label: "Set" },
  { key: "picking",  label: "Pick" },
  { key: "complete", label: "Share" },
];

function Stepper({ activeStage }) {
  if (!activeStage) return null;
  const activeIdx = STEPPER_STAGES.findIndex(s => s.key === activeStage);
  if (activeIdx < 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
      marginBottom: 10,
    }}>
      {STEPPER_STAGES.map((s, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        return (
          <React.Fragment key={s.key}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--text1)" : (isPast ? "var(--text2)" : "var(--text3)"),
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: isActive ? "var(--brand)" : (isPast ? "var(--text2)" : "var(--border)"),
              }} />
              {s.label}
            </span>
            {i < STEPPER_STAGES.length - 1 && (
              <span style={{
                width: 16, height: 1, background: "var(--border)",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function StageHeader({ onBack, label, title, subtitle, activeStage, onDelete }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {(onBack || onDelete) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8,
        }}>
          {onBack ? (
            <button onClick={onBack} style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "var(--text2)",
              fontFamily: "inherit", padding: 0,
            }}>← {label || "back"}</button>
          ) : <span/>}
          {onDelete && (
            <button onClick={onDelete} aria-label="Delete challenge"
              title="Delete challenge"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text3)", padding: 4,
                display: "flex", alignItems: "center",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          )}
        </div>
      )}
      <Stepper activeStage={activeStage} />
      <h1 style={{
        fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text1)",
        letterSpacing: "-0.01em",
      }}>{title}</h1>
      {subtitle && (
        <p style={{ fontSize: 12, color: "var(--text2)", margin: "3px 0 0", lineHeight: 1.4 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Create stage ────────────────────────────────────────────────────
// Exported so ChallengesView can render it directly for the "+ New
// challenge" flow without first creating an empty Supabase row.
// Same component the in-flow "Edit constraints" link uses; the
// `challenge` prop is null for new-challenge mode.
export function CreateStage({ challenge, onSubmit, onCancel, onDelete }) {
  const [count, setCount] = useState(challenge?.targetCount || 3);
  const [budget, setBudget] = useState(challenge?.budget || 50000);
  const [title, setTitle] = useState(challenge?.name || "");
  // Comma-formatted display value for the budget input. The numeric
  // `budget` state is the source of truth; this string is what the
  // user sees + types in. Re-derives whenever budget changes (e.g.
  // an Edit-constraints flow loads existing budget).
  const [budgetText, setBudgetText] = useState(() =>
    new Intl.NumberFormat("en-US").format(challenge?.budget || 50000),
  );

  const titlePlaceholder = `${count} watch${count === 1 ? "" : "es"} for $${(budget / 1000).toFixed(0)}k`;

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    border: "0.5px solid var(--border)", borderRadius: 8,
    background: "var(--surface)", padding: "10px 12px",
    fontSize: 14, fontFamily: "inherit", color: "var(--text1)", outline: "none",
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: "var(--text2)",
    textTransform: "uppercase", letterSpacing: "0.04em",
    margin: "0 0 6px",
  };
  const hintStyle = {
    fontSize: 12, color: "var(--text3)", margin: "5px 0 0", lineHeight: 1.4,
  };

  const handleBudgetChange = (e) => {
    // Strip everything that isn't a digit; reformat with commas.
    // Letting the user type anything else (commas, $, periods) is
    // tolerated — we just normalise on each keystroke.
    const raw = (e.target.value || "").replace(/[^\d]/g, "");
    const n = raw === "" ? 0 : parseInt(raw, 10);
    setBudget(Number.isFinite(n) ? n : 0);
    setBudgetText(raw === "" ? "" : new Intl.NumberFormat("en-US").format(n));
  };

  const handleSubmit = () => {
    onSubmit({
      name: (title || titlePlaceholder).trim(),
      targetCount: Math.max(1, Math.min(10, count | 0)),
      budget: Math.max(0, budget | 0),
      // Description field dropped from the form (Mark 2026-05-06: too
      // many fields). descriptionLong stays null on creates; Edit
      // flows on existing challenges that already had a description
      // preserve it via the spread on the existing row server-side.
      descriptionLong: null,
    });
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <StageHeader
        label={challenge ? "back to challenge" : "back to challenges"}
        onBack={onCancel}
        title={challenge ? "Edit constraints" : "New challenge"}
        activeStage="create"
        onDelete={challenge ? onDelete : undefined}
      />

      <div style={{ marginBottom: 16 }}>
        <p style={labelStyle}>Title</p>
        <input type="text" value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          style={inputStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={labelStyle}>Number of watches</p>
        <input type="number" min={1} max={10} value={count}
          onChange={e => setCount(Math.max(1, Math.min(10, parseInt(e.target.value || "1") | 0)))}
          style={inputStyle} />
        <p style={hintStyle}>1 to 10. Most people pick 3 or 5.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>Budget (USD)</p>
        <input
          type="text" inputMode="numeric"
          value={budgetText ? `$${budgetText}` : ""}
          onChange={handleBudgetChange}
          placeholder="$50,000"
          style={inputStyle}
        />
        <p style={hintStyle}>Soft cap of 20% over budget — you can complete with a confirm above that, but no further.</p>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{
          padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--border)",
          background: "transparent", color: "var(--text2)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13,
        }}>Cancel</button>
        <button onClick={handleSubmit} disabled={count < 1 || budget <= 0}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "var(--brand)", color: "#fff", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: (count < 1 || budget <= 0) ? 0.5 : 1,
          }}>Start picking →</button>
      </div>
    </div>
  );
}


// ── Picking stage ───────────────────────────────────────────────────
// Mark 2026-05-06: separate Reasoning stage felt like an extra step.
// Comments are now inline notes below the slot grid right here in
// Picking, and "Mark complete →" jumps straight to Complete. The
// Reasoning stage component is gone — this used to live there.
// ── Picking stage ───────────────────────────────────────────────────
// D3 (2026-05-06): wholesale rewrite per Mark's feedback.
//   - No shortlist concept. Lists/Favorites ARE the shortlist.
//     Tap a tile in the source picker → fills the next empty slot
//     directly as a pick.
//   - No drag-drop. Click-pick is the single interaction mode on
//     every device.
//   - Stat row sticks to the top of the scroll container so spend +
//     remaining stay visible while the user scrolls source tiles.
//   - Single page-scroll — source picker no longer has its own
//     overflow window competing with the shell scroll.
//   - One challenge-wide note (challenges.descriptionLong) replaces
//     the per-pick reasoning textareas. Debounced write-through.
function PickingStage({
  challenge, items, allListings, watchlist, hidden,
  collections, itemsByCollection,
  onAddAsPick, onRemovePick, onUpdateChallenge,
  onComplete, onEditConfig, onBack, onDelete,
  primaryCurrency,
}) {
  // Picks ordered by added_at ascending — first-added → leftmost
  // slot, stable across re-renders so the user's visual map of
  // "slot 1 = first pick" doesn't shift when they add a new one.
  const picks = useMemo(
    () => items.filter(it => it.isPick)
      .slice()
      .sort((a, b) => String(a.savedAt || "").localeCompare(String(b.savedAt || "")))
      .slice(0, challenge.targetCount),
    [items, challenge.targetCount],
  );
  const slotItems = Array.from({ length: challenge.targetCount }, (_, i) => picks[i] || null);

  const totalSpend = picks.reduce((s, p) => s + (p.savedPriceUSD || p.priceUSD || 0), 0);
  const overBy = Math.max(0, totalSpend - challenge.budget);
  const overPct = challenge.budget ? (overBy / challenge.budget) * 100 : 0;
  const overBudget = totalSpend > challenge.budget;
  const hardBlocked = overPct > 20;
  const allFilled = picks.length === challenge.targetCount;
  const canComplete = allFilled && !hardBlocked;

  // Source picker state
  const userLists = useMemo(
    () => (collections || []).filter(c => c.type === "free-form" && !c.is_shared_inbox),
    [collections],
  );
  const [addSource, setAddSource] = useState(() => {
    if (watchlist && Object.keys(watchlist).length > 0) return "favorites";
    if (userLists[0]) return `list:${userLists[0].id}`;
    return "paste";
  });
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteError, setPasteError] = useState("");

  const sourceWatches = useMemo(() => {
    const inThis = new Set(items.map(it => it.id));
    let pool = [];
    if (addSource === "favorites") {
      pool = Object.values(watchlist || {});
    } else if (addSource.startsWith("list:")) {
      const id = addSource.slice(5);
      pool = (itemsByCollection && itemsByCollection[id]) || [];
    }
    return pool
      .filter(w => w && w.id && !inThis.has(w.id) && !hidden[w.id])
      .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
  }, [addSource, watchlist, itemsByCollection, items, hidden]);

  const resolvePastedId = useCallback((raw) => {
    if (!raw) return null;
    const text = raw.trim();
    if (!text) return null;
    if (/^[0-9a-f]{8,16}$/i.test(text)) return text.toLowerCase();
    let url;
    try { url = new URL(text); } catch { return null; }
    const isOurs = /(?:^|\.)the-watch-list\.app$/i.test(url.hostname);
    if (isOurs) {
      const m = url.pathname.match(/^\/share\/([^/?#]+)/);
      if (m) return decodeURIComponent(m[1]);
      const listing = url.searchParams.get("listing");
      if (listing) return listing;
    }
    if (Array.isArray(allListings) && allListings.length) {
      const exact = allListings.find(l => l && l.url === text);
      if (exact) return exact.id;
      const stripped = text.split("?")[0].split("#")[0];
      const loose = allListings.find(l => l && l.url && l.url.split("?")[0].split("#")[0] === stripped);
      if (loose) return loose.id;
    }
    return null;
  }, [allListings]);

  const handleSourceTap = useCallback((watch) => {
    if (allFilled) return;
    onAddAsPick(watch);
  }, [allFilled, onAddAsPick]);

  const handlePaste = useCallback(() => {
    setPasteError("");
    if (allFilled) {
      setPasteError("All slots filled. Remove a pick to add another.");
      return;
    }
    const id = resolvePastedId(pasteUrl);
    if (!id) {
      setPasteError("Couldn't parse that. Paste a Watchlist share URL, dealer URL, or 12-char ID.");
      return;
    }
    if (items.some(it => it.id === id)) {
      setPasteError("That watch is already in this challenge.");
      return;
    }
    const listing = (allListings || []).find(l => l && l.id === id);
    if (!listing) {
      setPasteError("Found an ID but no matching listing in the current feed (might've sold or been removed).");
      return;
    }
    onAddAsPick(listing);
    setPasteUrl("");
  }, [allFilled, pasteUrl, resolvePastedId, items, allListings, onAddAsPick]);

  // Single challenge-wide note. Source of truth =
  // challenge.descriptionLong; local state mirrors so typing isn't
  // latency-bound, debounced flush every 800ms after edits stop.
  const [noteDraft, setNoteDraft] = useState(challenge.descriptionLong || "");
  const noteDirty = useRef(false);
  useEffect(() => {
    // Sync external changes (e.g. another tab) when the user isn't
    // actively typing.
    if (!noteDirty.current) setNoteDraft(challenge.descriptionLong || "");
  }, [challenge.descriptionLong]);
  useEffect(() => {
    if (!noteDirty.current) return;
    const timer = setTimeout(() => {
      onUpdateChallenge({ descriptionLong: noteDraft.trim() || null });
      noteDirty.current = false;
    }, 800);
    return () => clearTimeout(timer);
  }, [noteDraft, onUpdateChallenge]);
  const flushNote = () => {
    if (noteDirty.current) {
      onUpdateChallenge({ descriptionLong: noteDraft.trim() || null });
      noteDirty.current = false;
    }
  };

  return (
    <div>
      <StageHeader
        label="back to challenges"
        onBack={onBack}
        title={challenge.name}
        activeStage="picking"
        onDelete={onDelete}
      />

      {/* Sticky stat row — stays visible while content scrolls
          below. Negative marginTop pulls the bg up to overlap the
          StageHeader's bottom margin so when content scrolls past
          there's no gap above the sticky. boxShadow gives a soft
          separation. Mark feedback 2026-05-07: the Finish CTA now
          lives inside the sticky alongside the stats so it stays
          visible while the user scrolls the source picker below.
          (The picker can be tall — having to scroll back up to
          confirm picks read as awkward.) */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5,
        background: "var(--bg)",
        paddingTop: 10, paddingBottom: 10,
        marginTop: -10,
        marginBottom: 6,
        boxShadow: "0 6px 8px -6px rgba(0,0,0,0.10)",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard
            label="Total spend"
            value={fmtUSD(totalSpend)}
            sub={overBudget
              ? `of ${fmtUSD(challenge.budget)}`
              : `${fmtUSD(Math.max(challenge.budget - totalSpend, 0))} left`}
            progress={Math.min((totalSpend / Math.max(challenge.budget, 1)) * 100, 100)}
            warn={overBudget}
            hardWarn={hardBlocked}
            warnLabel={overBudget ? (
              hardBlocked
                ? `over by ${fmtUSD(overBy)} · past 20% cap`
                : `over by ${fmtUSD(overBy)} · ${overPct.toFixed(0)}% over`
            ) : null}
          />
          <StatCard
            label="Picks"
            value={`${picks.length}`}
            sub={`of ${challenge.targetCount}`}
            progress={(picks.length / challenge.targetCount) * 100}
          />
        </div>
        {/* Finish CTA — full width, sits in the sticky so it's
            always visible regardless of where the user is scrolled. */}
        <div style={{ marginTop: 10 }}>
          <button disabled={!canComplete}
            onClick={() => {
              flushNote();
              if (overBudget) {
                if (window.confirm(`You're ${fmtUSD(overBy)} over budget. Finish anyway?`)) onComplete();
              } else { onComplete(); }
            }}
            style={{
              width: "100%",
              padding: "10px 18px", borderRadius: 8, border: "none",
              background: "var(--brand)", color: "#fff",
              cursor: canComplete ? "pointer" : "not-allowed",
              fontFamily: "inherit", fontSize: 14, fontWeight: 500,
              opacity: canComplete ? 1 : 0.4,
            }}>
            Finish →
          </button>
        </div>
      </div>

      {/* Pick slot grid */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
            Final picks
          </p>
          <button onClick={onEditConfig} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text3)", fontSize: 12, fontFamily: "inherit", padding: 0,
          }}>Edit constraints</button>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(challenge.targetCount, 5)}, 1fr)`,
          gap: 10,
        }}>
          {slotItems.map((occupant, slotIdx) => (
            <SlotCell key={slotIdx} slotIdx={slotIdx} occupant={occupant}
              onRemove={() => occupant && onRemovePick(occupant)} />
          ))}
        </div>
        {!allFilled && (
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 10, fontStyle: "italic" }}>
            Tap a watch below to fill the next slot. {challenge.targetCount - picks.length} slot{challenge.targetCount - picks.length > 1 ? "s" : ""} left.
          </p>
        )}
        {allFilled && hardBlocked && (
          <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>
            Too far over budget — remove a pick to continue.
          </p>
        )}
        {allFilled && overBudget && !hardBlocked && (
          <p style={{ fontSize: 12, color: "var(--accent-warn)", marginTop: 10 }}>
            Over budget — soft warn. You can complete with explicit confirmation.
          </p>
        )}
      </div>

      {/* Single challenge-wide note (replaces per-pick reasoning).
          Saves to challenges.descriptionLong with a debounced flush. */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" }}>
          Note <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--text3)" }}>· optional</span>
        </p>
        <textarea
          value={noteDraft}
          onChange={(e) => { noteDirty.current = true; setNoteDraft(e.target.value); }}
          onBlur={flushNote}
          placeholder="Why these picks? (one note for the whole challenge)"
          rows={2}
          style={{
            width: "100%", boxSizing: "border-box", resize: "vertical",
            border: "0.5px solid var(--border)", borderRadius: 6,
            background: "var(--bg)", padding: "8px 10px",
            fontFamily: "inherit", fontSize: 13, color: "var(--text1)", outline: "none",
            lineHeight: 1.45,
          }}
        />
      </div>

      {/* (Bottom Finish CTA retired 2026-05-07 — moved into the
          sticky stat row above so it stays visible while the user
          scrolls the source picker.) */}

      {/* Source picker — Lists / Favorites tile grid + URL paste.
          Always visible, no overflow cap, no toggle. The page is the
          single scroll surface (Mark 2026-05-06: "scrolling isn't
          working well from a UI perspective. it scrolls the page
          then the picks. just one scroll"). */}
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
        <div style={{
          display: "flex", gap: 6, marginBottom: 10,
          overflowX: "auto", paddingBottom: 2,
          WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
        }}>
          <SourceChip
            active={addSource === "favorites"}
            onClick={() => setAddSource("favorites")}
            label={`♥ Favorites · ${Object.keys(watchlist || {}).length}`}
          />
          {userLists.map(c => (
            <SourceChip key={c.id}
              active={addSource === `list:${c.id}`}
              onClick={() => setAddSource(`list:${c.id}`)}
              label={`${c.name} · ${(itemsByCollection?.[c.id] || []).length}`}
            />
          ))}
          <SourceChip
            active={addSource === "paste"}
            onClick={() => setAddSource("paste")}
            label="+ Paste link"
          />
        </div>

        {addSource === "paste" ? (
          <div>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 6px", lineHeight: 1.4 }}>
              Paste a Watchlist share URL, a dealer URL, or a 12-char watch ID.
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" value={pasteUrl}
                onChange={(e) => { setPasteUrl(e.target.value); setPasteError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePaste(); } }}
                placeholder="https://the-watch-list.app/share/…"
                style={{
                  flex: 1, boxSizing: "border-box",
                  border: "0.5px solid var(--border)", borderRadius: 6,
                  background: "var(--bg)", padding: "8px 10px",
                  fontFamily: "inherit", fontSize: 13, color: "var(--text1)", outline: "none",
                }}
              />
              <button onClick={handlePaste} style={{
                padding: "8px 14px", borderRadius: 6, border: "none",
                background: "var(--brand)", color: "#fff", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              }}>Add</button>
            </div>
            {pasteError && (
              <p style={{ fontSize: 12, color: "var(--danger)", margin: "6px 0 0", lineHeight: 1.4 }}>
                {pasteError}
              </p>
            )}
          </div>
        ) : sourceWatches.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text3)", margin: "12px 4px", fontStyle: "italic" }}>
            {addSource === "favorites"
              ? "No favorites available. Heart watches in Listings to populate this."
              : "This list is empty (or every item is already in your challenge)."}
          </p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: 6,
            opacity: allFilled ? 0.5 : 1,
          }}>
            {sourceWatches.map(w => (
              <SourceTile key={w.id} item={w}
                onTap={() => handleSourceTap(w)}
                primaryCurrency={primaryCurrency} />
            ))}
          </div>
        )}
        {allFilled && addSource !== "paste" && sourceWatches.length > 0 && (
          <p style={{
            marginTop: 10, fontSize: 12, color: "var(--text3)",
            textAlign: "center", fontStyle: "italic",
          }}>
            All slots filled. Tap × on a pick above to free a slot.
          </p>
        )}
      </div>
    </div>
  );
}

// ── SlotCell (D3) ───────────────────────────────────────────────────
// Drag-drop and the desktop/mobile branching are gone — every device
// uses click-pick. Empty = "+ Slot N" hint; filled = thumbnail +
// brand/ref + price + a small × in the corner to remove.
function SlotCell({ occupant, slotIdx, onRemove }) {
  const baseStyle = {
    background: occupant ? "var(--card-bg)" : "transparent",
    border: occupant ? "0.5px solid var(--border)" : "1.5px dashed var(--border)",
    borderRadius: 8, padding: 6, minHeight: 110,
    display: "flex", flexDirection: "column",
    position: "relative",
  };
  if (!occupant) {
    return (
      <div style={baseStyle}>
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          color: "var(--text3)", textAlign: "center", padding: 8,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
          <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "6px 0 0" }}>
            Slot {slotIdx + 1}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div style={baseStyle}>
      <button onClick={onRemove}
        aria-label={`Remove pick ${slotIdx + 1}`}
        title="Remove this pick"
        style={{
          position: "absolute", top: 4, right: 4, zIndex: 2,
          width: 22, height: 22, borderRadius: "50%",
          border: "none", background: "rgba(0,0,0,0.55)",
          color: "#fff", cursor: "pointer", padding: 0,
          fontFamily: "inherit", fontSize: 14, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >×</button>
      <div style={{
        aspectRatio: "4 / 3", background: "var(--bg)", borderRadius: 4, marginBottom: 4,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {occupant.img ? (
          <img src={imgSrc(occupant.img)} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 18, color: "var(--text3)" }}>⌚</span>
        )}
      </div>
      <p style={{
        fontSize: 11, fontWeight: 500, margin: "0 0 1px",
        color: "var(--text1)", lineHeight: 1.2,
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
      }}>
        {occupant.brand}
      </p>
      <p style={{
        fontSize: 10, color: "var(--text2)", margin: "0 0 3px",
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
      }}>
        {occupant.ref || ""}
      </p>
      <p style={{ fontSize: 11, fontWeight: 500, margin: 0, color: "var(--text1)" }}>
        {fmtUSD(occupant.savedPriceUSD || occupant.priceUSD || 0)}
      </p>
    </div>
  );
}

function SourceChip({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0,
      padding: "5px 11px",
      borderRadius: 999,
      border: "0.5px solid var(--border)",
      background: active ? "var(--text1)" : "transparent",
      color: active ? "var(--bg)" : "var(--text1)",
      cursor: "pointer", fontFamily: "inherit", fontSize: 12,
      whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

// Compact card-tile for the source picker. Tap = add to shortlist.
// Square image + brand + price in a tight stack so users can scan a
// list of 60+ items quickly. Uses imgSrc() so hot-link-protected
// dealer images route through the proxy.
function SourceTile({ item, onTap, primaryCurrency }) {
  return (
    <button onClick={onTap}
      title={`Add to shortlist: ${item.brand || ""}${item.ref ? ` ${item.ref}` : ""}`}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--card-bg)",
        border: "0.5px solid var(--border)", borderRadius: 6,
        padding: 0, overflow: "hidden",
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}
    >
      <div style={{
        aspectRatio: "1", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {item.img ? (
          <img src={imgSrc(item.img)} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{ fontSize: 18, color: "var(--text3)" }}>⌚</span>
        )}
      </div>
      <div style={{ padding: "5px 6px" }}>
        <p style={{
          fontSize: 11, fontWeight: 500, margin: "0 0 1px", color: "var(--text1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.25,
        }}>
          {item.brand}{item.ref ? ` ${item.ref}` : ""}
        </p>
        <p style={{
          fontSize: 11, color: "var(--text2)", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {fmtUSD(item.savedPriceUSD || item.priceUSD || item.price || 0)}
        </p>
      </div>
    </button>
  );
}


function StatCard({ label, value, sub, progress, warn, hardWarn, warnLabel }) {
  return (
    <div style={{
      background: "var(--card-bg)", borderRadius: 8,
      border: hardWarn ? "0.5px solid var(--danger)" : "0.5px solid var(--border)",
      padding: "12px 14px",
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase",
                  letterSpacing: "0.04em", margin: "0 0 6px" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: warn ? "var(--accent-warn)" : "var(--text1)" }}>{value}</span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>{sub}</span>
      </div>
      <div style={{ height: 2, background: "var(--surface)", borderRadius: 0, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: hardWarn ? "var(--danger)" : warn ? "var(--accent-warn)" : "var(--text1)",
          transition: "width 0.2s ease",
        }} />
      </div>
      {warnLabel && (
        <p style={{ fontSize: 11, color: hardWarn ? "var(--danger)" : "var(--accent-warn)", margin: "6px 0 0", fontStyle: "italic" }}>
          {warnLabel}
        </p>
      )}
    </div>
  );
}


// ── Complete stage ──────────────────────────────────────────────────
function CompleteStage({ challenge, items, onShareSpec, onShareComplete, onBack, onReopen, onDelete }) {
  const picks = useMemo(() => items.filter(it => it.isPick), [items]);
  const totalSpend = picks.reduce((s, p) => s + (p.savedPriceUSD || p.priceUSD || 0), 0);
  const overBy = Math.max(0, totalSpend - challenge.budget);

  // Share feedback. Two share modes (v1.5):
  //   "Send as challenge" → constraints only (?newchallenge=…).
  //   "Send as completed" → picks visible (?challenge=<id>&shared=1)
  //                         via the public-read RPC.
  // handleShare returns { copied: bool } — desktop clipboard true,
  // mobile native-share false. Flash a confirmation pill either way.
  const [shareFeedback, setShareFeedback] = useState("");
  const handleShareClick = async (handler, mode) => {
    const res = await handler();
    const tag = mode === "complete" ? "with picks" : "constraints";
    if (res?.copied) setShareFeedback(`${tag === "with picks" ? "Picks link" : "Constraints link"} copied!`);
    else setShareFeedback(`Shared (${tag}).`);
    setTimeout(() => setShareFeedback(""), 2400);
  };

  return (
    <div>
      <StageHeader label="back to challenges" onBack={onBack} title={challenge.name}
        subtitle={challenge.descriptionLong}
        activeStage="complete"
        onDelete={onDelete} />

      {/* Action bar — Reopen + Share at the TOP of the card so the
          user doesn't have to scroll past the picks list to find
          them. Mark 2026-05-06: "Share button should be higher so
          no scroll needed same with reopen for edits." */}
      <div style={{
        display: "flex", justifyContent: "flex-end", alignItems: "center",
        gap: 8, flexWrap: "wrap",
        marginBottom: 12,
      }}>
        {shareFeedback && (
          <span aria-live="polite" style={{
            fontSize: 12, color: "var(--text2)", marginRight: "auto",
            background: "var(--surface)", border: "0.5px solid var(--border)",
            padding: "4px 10px", borderRadius: 999,
          }}>{shareFeedback}</span>
        )}
        {onReopen && (
          <button onClick={onReopen} style={{
            padding: "9px 14px", borderRadius: 8,
            border: "0.5px solid var(--border)", background: "transparent",
            color: "var(--text2)", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13,
          }}>Reopen for edits</button>
        )}
        {onShareSpec && (
          <button onClick={() => handleShareClick(onShareSpec, "spec")}
            title="Send just the constraints — recipient builds their own answer"
            style={{
              padding: "9px 14px", borderRadius: 8,
              border: "0.5px solid var(--border)", background: "transparent",
              color: "var(--text1)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13,
            }}>Share the challenge</button>
        )}
        {onShareComplete && (
          <button onClick={() => handleShareClick(onShareComplete, "complete")}
            title="Send with your picks visible — recipient sees what you chose"
            style={{
              padding: "9px 16px", borderRadius: 8, border: "none",
              background: "var(--brand)", color: "#fff", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 500,
            }}>Share my collection →</button>
        )}
      </div>

      {/* Polished card surface. Same border + shadow treatment as
          the share-receive landing card so completed challenges
          feel like first-class artefacts. */}
      <div style={{
        background: "var(--card-bg)",
        borderRadius: 12, border: "0.5px solid var(--border)",
        boxShadow: "var(--shadow-modal)",
        padding: 18,
      }}>
        <div style={{
          textAlign: "center",
          borderBottom: "0.5px solid var(--border)",
          paddingBottom: 12, marginBottom: 14,
        }}>
          <p style={{
            fontSize: 11, fontWeight: 600, color: "var(--text2)",
            textTransform: "uppercase", letterSpacing: "0.04em",
            margin: "0 0 4px",
          }}>
            Watch challenge · complete
          </p>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
            {fmtUSD(totalSpend)} of {fmtUSD(challenge.budget)}
            {overBy > 0 && <span style={{ color: "var(--accent-warn)" }}> · over by {fmtUSD(overBy)}</span>}
          </p>
        </div>
        {picks.map((p, i) => (
          <div key={p.rowId} style={{
            display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 12,
            alignItems: "center",
            paddingBottom: 12, marginBottom: 12,
            borderBottom: i < picks.length - 1 ? "0.5px solid var(--border)" : "none",
          }}>
            <div style={{
              aspectRatio: "1", background: "var(--bg)", borderRadius: 6,
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {p.img ? (
                <img src={imgSrc(p.img)} alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 18, color: "var(--text3)" }}>⌚</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text1)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{p.brand} {p.ref || ""}</p>
              <p style={{
                fontSize: 12, color: "var(--text2)", margin: "1px 0 0",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{p.source}</p>
            </div>
            <p style={{
              fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text1)",
              whiteSpace: "nowrap",
            }}>
              {fmtUSD(p.savedPriceUSD || 0)}
            </p>
          </div>
        ))}
      </div>

      <p style={{
        marginTop: 12, fontSize: 11, color: "var(--text3)",
        textAlign: "center", lineHeight: 1.5,
      }}>
        <strong style={{ color: "var(--text2)" }}>Share the challenge</strong> sends only the spec — recipient builds their own answer.
        {" "}<strong style={{ color: "var(--text2)" }}>Share my collection</strong> reveals your picks.
      </p>
    </div>
  );
}

// ── Top-level orchestrator ──────────────────────────────────────────
export function ChallengeFlow({
  challenge, items,
  allListings, watchlist, hidden, primaryCurrency,
  collectionsApi,                  // useCollections() return value
  handleShare,                     // App.js share handler — called with the challenge URL
  user,                            // for &from=<sender name> attribution on shares (PR #90)
  onExit,                          // back to ChallengesList
}) {
  // Delete affordance lives inside the drill-in (StageHeader) since
  // 2026-05-06 PR #84 dropped the inline list-row delete to match
  // the Lists card style. Confirms, deletes, then exits to the list.
  const handleDelete = useCallback(async () => {
    if (!collectionsApi?.deleteCollection) return;
    const ok = window.confirm(
      `Delete "${challenge.name}"? This can't be undone.`
    );
    if (!ok) return;
    await collectionsApi.deleteCollection(challenge.id);
    if (typeof onExit === "function") onExit();
  }, [challenge.id, challenge.name, collectionsApi, onExit]);
  // Stage is local component state, derived from data on initial
  // mount. The user's explicit navigation overrides; refresh re-derives.
  const [stage, setStage] = useState(() => inferStage(challenge, items));

  // If the challenge data changes (e.g. updateChallenge resolves and
  // the parent re-renders us with a fresh challenge), update stage
  // when it makes sense — but don't yank the user out of a stage they
  // explicitly navigated to. Soft sync only.
  useEffect(() => {
    if (challenge?.state === "complete" && stage !== "complete") setStage("complete");
    if (!challenge?.targetCount && stage !== "create") setStage("create");
  }, [challenge?.state, challenge?.targetCount]);

  // ── Stage-specific handlers ────────────────────────────────
  const submitConfig = useCallback(async (config) => {
    await collectionsApi.updateChallenge(challenge.id, config);
    setStage("picking");
  }, [challenge.id, collectionsApi]);

  // D3 (2026-05-06): no more shortlist. Tap a tile in the source
  // picker → adds straight as a pick at the next available slot.
  // Tap × on a pick → removes it from the challenge entirely.
  // Drag-drop is gone too — click-pick is the single interaction
  // mode on every device.
  const addAsPick = useCallback(async (listing) => {
    await collectionsApi.addToShortlist(challenge.id, listing, { isPick: true });
  }, [challenge.id, collectionsApi]);

  const removePick = useCallback(async (item) => {
    if (!item) return;
    await collectionsApi.removeItemFromCollection(challenge.id, item.id);
  }, [challenge.id, collectionsApi]);

  const updateChallengePatch = useCallback(async (patch) => {
    await collectionsApi.updateChallenge(challenge.id, patch);
  }, [challenge.id, collectionsApi]);

  const reopenChallenge = useCallback(async () => {
    await collectionsApi.updateChallenge(challenge.id, { state: "draft" });
    setStage("picking");
  }, [challenge.id, collectionsApi]);

  const completeChallenge = useCallback(async () => {
    await collectionsApi.updateChallenge(challenge.id, { state: "complete" });
    setStage("complete");
  }, [challenge.id, collectionsApi]);

  const updateReasoning = useCallback(async (rowId, reasoning) => {
    await collectionsApi.updateReasoning(rowId, reasoning);
  }, [collectionsApi]);

  // Spec mode — recipient sees only the constraints and is invited
  // to build their own answer. Existing behaviour, used everywhere
  // pre-v1.5 and still the only mode for draft challenges.
  //
  // PR #90 (2026-05-06): append &from=<senderName> so the recipient
  // can attribute the saved draft to the sender. Sender name is
  // derived from auth metadata — Google sign-in surfaces full_name;
  // we fall back to the email's local part. Users without a usable
  // name skip the param.
  const senderName = useMemo(() => deriveSenderName(user), [user]);
  const shareChallengeSpec = useCallback(async () => {
    if (!handleShare) return { copied: false };
    const params = new URLSearchParams();
    params.set("newchallenge", "1");
    if (challenge.name)             params.set("t", challenge.name);
    if (challenge.targetCount)      params.set("n", String(challenge.targetCount));
    if (challenge.budget)           params.set("b", String(challenge.budget));
    if (challenge.descriptionLong)  params.set("d", challenge.descriptionLong);
    if (senderName)                 params.set("from", senderName);
    const url = `${window.location.origin}/?${params.toString()}`;
    return await handleShare({ title: `Watch challenge: ${challenge.name}`, url });
  }, [challenge.id, challenge.name, challenge.targetCount, challenge.budget, challenge.descriptionLong, handleShare, senderName]);

  // Complete mode (v1.5) — recipient sees the sender's picks via
  // the public-read RPC. Only meaningful when state='complete'; the
  // RPC silently returns null otherwise. Surface as a separate
  // button on CompleteStage; not exposed on draft challenges.
  const shareChallengeComplete = useCallback(async () => {
    if (!handleShare) return { copied: false };
    const url = `${window.location.origin}/?challenge=${encodeURIComponent(challenge.id)}&shared=1`;
    return await handleShare({ title: `Watch challenge: ${challenge.name}`, url });
  }, [challenge.id, challenge.name, handleShare]);

  // ── Render the active stage ────────────────────────────────
  if (stage === "create") {
    return (
      <CreateStage challenge={challenge}
        onSubmit={submitConfig}
        onCancel={onExit}
        onDelete={handleDelete} />
    );
  }
  if (stage === "complete") {
    return (
      <CompleteStage challenge={challenge} items={items}
        onShareSpec={shareChallengeSpec}
        onShareComplete={shareChallengeComplete}
        onReopen={reopenChallenge}
        onBack={onExit}
        onDelete={handleDelete} />
    );
  }
  // Default: picking. D3: drag-drop + shortlist concept retired —
  // tap a source tile to add as a pick, tap × on a slot to remove,
  // single challenge-wide note (descriptionLong) instead of per-pick.
  return (
    <PickingStage
      challenge={challenge} items={items}
      allListings={allListings} watchlist={watchlist} hidden={hidden}
      collections={collectionsApi?.collections || []}
      itemsByCollection={collectionsApi?.itemsByCollection || {}}
      primaryCurrency={primaryCurrency}
      onAddAsPick={addAsPick}
      onRemovePick={removePick}
      onUpdateChallenge={updateChallengePatch}
      onComplete={completeChallenge}
      onEditConfig={() => setStage("create")}
      onBack={onExit}
      onDelete={handleDelete}
    />
  );
}

// Convenience helper — quick check for whether a collection IS a
// challenge. Used by WatchlistTab to filter the Collections list.
export function isChallenge(collection) {
  return collection?.type === "challenge";
}

// Derive a public-facing display name from the auth user object.
// Used as the &from=<name> query param on shared spec links so the
// recipient can attribute the saved draft. PR #90, 2026-05-06.
//
// Order of preference:
//   1. user.user_metadata.full_name (Google sign-in surfaces this)
//   2. user.user_metadata.name      (some providers use this key)
//   3. email local-part, capitalized (last resort)
//   4. null — no usable name; the share link omits &from=
//
// Display name is intentionally derived rather than stored — Mark
// hasn't asked for a separate "Your sharing name" setting yet, and
// the auth display name is what users would expect to see anyway.
function deriveSenderName(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const fromMeta = (meta.full_name || meta.name || "").trim();
  if (fromMeta) return fromMeta;
  const email = user.email || "";
  const local = email.split("@")[0];
  if (!local) return null;
  // Capitalize first character so "james" → "James".
  return local.charAt(0).toUpperCase() + local.slice(1);
}
