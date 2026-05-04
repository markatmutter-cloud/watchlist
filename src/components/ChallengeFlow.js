import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "./Card";
import { fmtUSD } from "../utils";

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

// ── Pointer detection ───────────────────────────────────────────────
// Same primitive the share-detection commit (c7f7aba) used. (pointer:
// fine) === mouse on every common platform; (coarse) === touch. We
// only enable HTML5 DnD when fine.
const hasFinePointer = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: fine)").matches;

// ── Stage inference ─────────────────────────────────────────────────
// Source-of-truth for which stage to land on after a refresh. The
// component overrides via setStage when the user explicitly navigates.
function inferStage(challenge, items) {
  if (!challenge) return "create";
  if (challenge.state === "complete") return "complete";
  if (!challenge.targetCount || !challenge.budget) return "create";
  const picks = items.filter(it => it.isPick);
  if (picks.length < challenge.targetCount) return "picking";
  return "reasoning";
}

// Container with the standard back-button + title block. Used by
// every stage for visual consistency with the rest of the app.
function StageHeader({ onBack, label, title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {onBack && (
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--text2)", marginBottom: 12,
          fontFamily: "inherit", padding: 0,
        }}>← {label || "back"}</button>
      )}
      <h1 style={{
        fontSize: 20, fontWeight: 600, margin: 0, color: "var(--text1)",
        letterSpacing: "-0.01em",
      }}>{title}</h1>
      {subtitle && (
        <p style={{ fontSize: 13, color: "var(--text2)", margin: "4px 0 0", lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Create stage ────────────────────────────────────────────────────
function CreateStage({ challenge, onSubmit, onCancel }) {
  const [count, setCount] = useState(challenge?.targetCount || 3);
  const [budget, setBudget] = useState(challenge?.budget || 50000);
  const [title, setTitle] = useState(challenge?.name || "");
  const [description, setDescription] = useState(challenge?.descriptionLong || "");

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

  const handleSubmit = () => {
    onSubmit({
      name: (title || titlePlaceholder).trim(),
      targetCount: Math.max(1, Math.min(10, count | 0)),
      budget: Math.max(0, budget | 0),
      descriptionLong: description.trim() || null,
    });
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <StageHeader
        label={challenge ? "back to challenge" : "back to challenges"}
        onBack={onCancel}
        title={challenge ? "Edit constraints" : "New challenge"}
        subtitle="Set the constraints. You can change them mid-flow if you change your mind."
      />

      <div style={{ marginBottom: 16 }}>
        <p style={labelStyle}>Number of watches</p>
        <input type="number" min={1} max={10} value={count}
          onChange={e => setCount(Math.max(1, Math.min(10, parseInt(e.target.value || "1") | 0)))}
          style={inputStyle} />
        <p style={hintStyle}>1 to 10. Most people pick 3 or 5.</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={labelStyle}>Budget (USD)</p>
        <input type="number" value={budget} step={1000}
          onChange={e => setBudget(parseInt(e.target.value || "0") | 0)}
          style={inputStyle} />
        <p style={hintStyle}>You can pick up to {fmtUSD(Math.round(budget * 1.2))} (20% over) before it hard-blocks.</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={labelStyle}>Title</p>
        <input type="text" value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          style={inputStyle} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>Description (optional)</p>
        <textarea value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Frame the challenge. Birthday hunt for my mum. Watches I'd actually wear."
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }} />
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
            background: "#185FA5", color: "#fff", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            opacity: (count < 1 || budget <= 0) ? 0.5 : 1,
          }}>Start picking →</button>
      </div>
    </div>
  );
}

// ── Slot picker (mobile tap-to-place) ───────────────────────────────
function SlotPickerModal({ slotsTotal, picks, watch, onPick, onCancel }) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: 12, maxWidth: 420, width: "100%",
        padding: 20, border: "0.5px solid var(--border)",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px", color: "var(--text1)" }}>
          Place {watch?.ref?.slice(0, 60) || "watch"}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 14px" }}>
          Pick a slot. Items already in slots get bumped to your shortlist.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
          {Array.from({ length: slotsTotal }).map((_, i) => {
            const occupant = picks[i];
            return (
              <button key={i} onClick={() => onPick(i)}
                style={{
                  padding: "12px 8px", borderRadius: 8,
                  border: occupant ? "0.5px solid var(--border)" : "1.5px dashed var(--border)",
                  background: occupant ? "var(--surface)" : "transparent",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
                }}>
                <span style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Slot {i + 1}
                </span>
                <span style={{ fontSize: 12, color: "var(--text1)", fontWeight: 500,
                              textAlign: "center", lineHeight: 1.2,
                              overflow: "hidden", textOverflow: "ellipsis",
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {occupant ? (occupant.ref || occupant.brand) : "empty"}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            padding: "8px 14px", borderRadius: 8, border: "0.5px solid var(--border)",
            background: "transparent", color: "var(--text2)", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13,
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Picking stage ───────────────────────────────────────────────────
function PickingStage({
  challenge, items, allListings, watchlist, hidden,
  onPlaceInSlot, onMoveToShortlist, onAddToShortlist, onComplete, onEditConfig, onBack,
  primaryCurrency,
}) {
  const picks = useMemo(
    () => items.filter(it => it.isPick).slice(0, challenge.targetCount),
    [items, challenge.targetCount],
  );
  const shortlist = useMemo(
    () => items.filter(it => !it.isPick),
    [items],
  );

  // Pad picks array out to slot count so render maps over fixed-size
  // slot grid even when partially filled.
  const slotItems = Array.from({ length: challenge.targetCount }, (_, i) => picks[i] || null);

  const totalSpend = picks.reduce((s, p) => s + (p.savedPriceUSD || p.priceUSD || 0), 0);
  const overBy = Math.max(0, totalSpend - challenge.budget);
  const overPct = challenge.budget ? (overBy / challenge.budget) * 100 : 0;
  const overBudget = totalSpend > challenge.budget;
  const hardBlocked = overPct > 20;
  const allFilled = picks.length === challenge.targetCount;
  const canComplete = allFilled && !hardBlocked;

  // Drag-drop only on fine pointers; mobile gets tap-to-place.
  const desktop = hasFinePointer();

  const [draggedItem, setDraggedItem] = useState(null);
  const [pickerOpenForItem, setPickerOpenForItem] = useState(null);
  const [showAddDrawer, setShowAddDrawer] = useState(items.length === 0);
  const [searchQuery, setSearchQuery] = useState("");

  // Recompute "show drawer" when items first arrive — empty challenges
  // get the drawer open by default; once any item exists we hide it
  // unless the user opens it explicitly.
  useEffect(() => {
    if (items.length > 0 && showAddDrawer && !searchQuery) {
      // Don't auto-close; let user explicitly toggle.
    }
  // eslint-disable-next-line
  }, [items.length]);

  const slotStyle = (occupied, isDragOver) => ({
    background: occupied ? "var(--card-bg)" : "transparent",
    border: isDragOver
      ? "1.5px solid #185FA5"
      : occupied ? "0.5px solid var(--border)" : "1.5px dashed var(--border)",
    borderRadius: 8, padding: 10, minHeight: 180,
    display: "flex", flexDirection: "column",
    transition: "all 0.12s ease",
  });

  const handleSlotDrop = (slotIdx) => {
    if (!draggedItem) return;
    onPlaceInSlot(draggedItem, slotIdx);
    setDraggedItem(null);
  };

  const handleShortlistTap = (item) => {
    if (desktop) return; // desktop uses drag; tap is a no-op
    setPickerOpenForItem(item);
  };

  const handleSlotPick = (slotIdx) => {
    if (pickerOpenForItem) {
      onPlaceInSlot(pickerOpenForItem, slotIdx);
      setPickerOpenForItem(null);
    }
  };

  // Search results for the add drawer — listings.json filtered by
  // the user's typed query, excluding items already in this challenge.
  const filteredResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    const inThis = new Set(items.map(it => it.id));
    return allListings
      .filter(l => !l.sold && !inThis.has(l.id) && !hidden[l.id])
      .filter(l => {
        const hay = (l.brand + " " + (l.ref || "") + " " + (l.source || "")).toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 25);
  }, [searchQuery, allListings, items, hidden]);

  return (
    <div>
      <StageHeader
        label="back to challenges"
        onBack={onBack}
        title={challenge.name}
        subtitle={challenge.descriptionLong || `${challenge.targetCount} watches for ${fmtUSD(challenge.budget)}`}
      />

      {/* Stat row — total spend + picks count */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <StatCard
          label="Total spend"
          value={fmtUSD(totalSpend)}
          sub={`of ${fmtUSD(challenge.budget)}`}
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

      {/* Picks slot grid */}
      <div style={{ marginBottom: 24 }}>
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
            <SlotCell key={slotIdx}
              slotIdx={slotIdx}
              occupant={occupant}
              desktop={desktop}
              onDragOver={desktop ? (e) => e.preventDefault() : undefined}
              onDrop={desktop ? (e) => { e.preventDefault(); handleSlotDrop(slotIdx); } : undefined}
              onDragStartItem={desktop ? () => setDraggedItem(occupant) : undefined}
              onDragEndItem={desktop ? () => setDraggedItem(null) : undefined}
              onTap={desktop ? undefined : () => occupant && onMoveToShortlist(occupant)}
              slotStyle={slotStyle(!!occupant, false)}
              primaryCurrency={primaryCurrency}
            />
          ))}
        </div>
        {!allFilled && (
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 10, fontStyle: "italic" }}>
            {desktop
              ? `Drag from your shortlist below. ${challenge.targetCount - picks.length} slot${challenge.targetCount - picks.length > 1 ? "s" : ""} left to fill.`
              : `Tap a shortlist item below to place it. ${challenge.targetCount - picks.length} slot${challenge.targetCount - picks.length > 1 ? "s" : ""} left to fill.`
            }
          </p>
        )}
        {allFilled && hardBlocked && (
          <p style={{ fontSize: 12, color: "#c0392b", marginTop: 10 }}>
            Too far over budget — trim a pick to continue.
          </p>
        )}
        {allFilled && overBudget && !hardBlocked && (
          <p style={{ fontSize: 12, color: "#c9a227", marginTop: 10 }}>
            Over budget — soft warn. You can complete with explicit confirmation.
          </p>
        )}
      </div>

      {/* Complete CTA */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <button disabled={!canComplete}
          onClick={() => {
            if (overBudget) {
              if (window.confirm(`You're ${fmtUSD(overBy)} over budget. Mark complete anyway?`)) onComplete();
            } else { onComplete(); }
          }}
          style={{
            padding: "10px 18px", borderRadius: 8, border: "none",
            background: "#185FA5", color: "#fff",
            cursor: canComplete ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontSize: 14, fontWeight: 500,
            opacity: canComplete ? 1 : 0.4,
          }}>
          Mark complete →
        </button>
      </div>

      {/* Shortlist + add drawer */}
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
            Shortlist · {shortlist.length} watch{shortlist.length === 1 ? "" : "es"}
          </p>
          <button onClick={() => setShowAddDrawer(o => !o)} style={{
            padding: "5px 10px", borderRadius: 6,
            border: "0.5px solid var(--border)",
            background: showAddDrawer ? "var(--text1)" : "transparent",
            color: showAddDrawer ? "var(--bg)" : "var(--text1)",
            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
          }}>+ Add to shortlist</button>
        </div>

        {showAddDrawer && (
          <div style={{
            background: "var(--surface)", border: "0.5px solid var(--border)",
            borderRadius: 8, padding: 12, marginBottom: 14,
          }}>
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search listings (brand, reference, dealer)…"
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                border: "0.5px solid var(--border)", borderRadius: 6,
                background: "var(--bg)", padding: "8px 10px",
                fontFamily: "inherit", fontSize: 13, color: "var(--text1)", outline: "none",
                marginBottom: 10,
              }} />
            {searchQuery.length >= 2 && filteredResults.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text3)", margin: "16px 0", textAlign: "center", fontStyle: "italic" }}>
                No matches.
              </p>
            )}
            {searchQuery.length < 2 && (
              <p style={{ fontSize: 12, color: "var(--text3)", margin: "8px 0 0", fontStyle: "italic" }}>
                Type at least 2 characters. Sold / hidden listings excluded.
              </p>
            )}
            {filteredResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {filteredResults.map(l => (
                  <SearchRow key={l.id} listing={l}
                    onAdd={() => { onAddToShortlist(l); setSearchQuery(""); }} />
                ))}
              </div>
            )}
          </div>
        )}

        {shortlist.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text3)" }}>
            <p style={{ fontSize: 13, margin: 0, fontStyle: "italic" }}>
              No shortlist yet — use "+ Add to shortlist" above to start.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
            {shortlist.map(item => (
              <ShortlistTile key={item.rowId} item={item}
                desktop={desktop}
                onDragStart={() => setDraggedItem(item)}
                onDragEnd={() => setDraggedItem(null)}
                onTap={() => handleShortlistTap(item)}
                onRemove={() => onMoveToShortlist({ ...item, _remove: true })}
                primaryCurrency={primaryCurrency} />
            ))}
          </div>
        )}
      </div>

      {pickerOpenForItem && (
        <SlotPickerModal slotsTotal={challenge.targetCount}
          picks={slotItems} watch={pickerOpenForItem}
          onPick={handleSlotPick}
          onCancel={() => setPickerOpenForItem(null)} />
      )}
    </div>
  );
}

function SlotCell({ occupant, slotIdx, desktop, onDragOver, onDrop, onDragStartItem, onDragEndItem, onTap, slotStyle, primaryCurrency }) {
  if (!occupant) {
    return (
      <div onDragOver={onDragOver} onDrop={onDrop} style={slotStyle}>
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
    <div
      draggable={desktop} onDragStart={onDragStartItem} onDragEnd={onDragEndItem}
      onDragOver={onDragOver} onDrop={onDrop}
      onClick={onTap}
      style={{ ...slotStyle, cursor: desktop ? "grab" : "pointer" }}>
      <div style={{
        aspectRatio: "1", background: "var(--bg)", borderRadius: 4, marginBottom: 8,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {occupant.img ? (
          <img src={occupant.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 22, color: "var(--text3)" }}>⌚</span>
        )}
      </div>
      <p style={{ fontSize: 12, fontWeight: 500, margin: "0 0 2px", color: "var(--text1)", lineHeight: 1.25,
                  overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {occupant.brand}
      </p>
      <p style={{ fontSize: 11, color: "var(--text2)", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {occupant.ref || ""}
      </p>
      <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: "var(--text1)" }}>
        {fmtUSD(occupant.savedPriceUSD || occupant.priceUSD || 0)}
      </p>
    </div>
  );
}

function ShortlistTile({ item, desktop, onDragStart, onDragEnd, onTap, onRemove, primaryCurrency }) {
  return (
    <div
      draggable={desktop} onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={onTap}
      style={{
        background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 6,
        padding: 6, cursor: desktop ? "grab" : "pointer", position: "relative",
      }}>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove from shortlist"
        style={{
          position: "absolute", top: 3, right: 3,
          width: 18, height: 18, borderRadius: 9,
          background: "var(--bg)", border: "0.5px solid var(--border)",
          color: "var(--text2)", cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, lineHeight: 1, fontFamily: "inherit",
        }}>×</button>
      <div style={{
        aspectRatio: "1", background: "var(--bg)", borderRadius: 4, marginBottom: 5,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.img ? (
          <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 18, color: "var(--text3)" }}>⌚</span>
        )}
      </div>
      <p style={{ fontSize: 11, fontWeight: 500, margin: "0 0 2px", color: "var(--text1)", lineHeight: 1.2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.brand} {item.ref || ""}
      </p>
      <p style={{ fontSize: 11, color: "var(--text2)", margin: 0 }}>
        {fmtUSD(item.priceUSD || item.price || 0)}
      </p>
    </div>
  );
}

function SearchRow({ listing, onAdd }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", background: "var(--bg)",
      border: "0.5px solid var(--border)", borderRadius: 6,
    }}>
      <div style={{
        width: 36, height: 36, background: "var(--surface)", borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        overflow: "hidden",
      }}>
        {listing.img ? (
          <img src={listing.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 14, color: "var(--text3)" }}>⌚</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 1px", color: "var(--text1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {listing.brand} {listing.ref || ""}
        </p>
        <p style={{ fontSize: 11, color: "var(--text2)", margin: 0 }}>
          {listing.source} · {fmtUSD(listing.priceUSD || listing.price || 0)}
        </p>
      </div>
      <button onClick={onAdd} style={{
        padding: "4px 10px", borderRadius: 6, border: "none",
        background: "#185FA5", color: "#fff", cursor: "pointer",
        fontFamily: "inherit", fontSize: 12, fontWeight: 500,
      }}>Add</button>
    </div>
  );
}

function StatCard({ label, value, sub, progress, warn, hardWarn, warnLabel }) {
  return (
    <div style={{
      background: "var(--card-bg)", borderRadius: 8,
      border: hardWarn ? "0.5px solid #c0392b" : "0.5px solid var(--border)",
      padding: "12px 14px",
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase",
                  letterSpacing: "0.04em", margin: "0 0 6px" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: warn ? "#c9a227" : "var(--text1)" }}>{value}</span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>{sub}</span>
      </div>
      <div style={{ height: 2, background: "var(--surface)", borderRadius: 1, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: hardWarn ? "#c0392b" : warn ? "#c9a227" : "var(--text1)",
          transition: "width 0.2s ease",
        }} />
      </div>
      {warnLabel && (
        <p style={{ fontSize: 11, color: hardWarn ? "#c0392b" : "#c9a227", margin: "6px 0 0", fontStyle: "italic" }}>
          {warnLabel}
        </p>
      )}
    </div>
  );
}

// ── Reasoning stage ─────────────────────────────────────────────────
function ReasoningStage({ challenge, items, onUpdateReasoning, onBack, onFinish }) {
  const picks = useMemo(() => items.filter(it => it.isPick), [items]);
  // Local mirror so typing isn't latency-bound to Supabase. Debounced
  // write-through on blur or explicit Save (via the 800ms timer
  // below). On unmount, flush any pending writes.
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(picks.map(p => [p.rowId, p.reasoning || ""])));
  const [pendingFlush, setPendingFlush] = useState({});

  useEffect(() => {
    // Sync new picks into drafts when items change.
    setDrafts(prev => {
      const next = { ...prev };
      for (const p of picks) {
        if (next[p.rowId] === undefined) next[p.rowId] = p.reasoning || "";
      }
      return next;
    });
    // eslint-disable-next-line
  }, [picks.length]);

  // Debounce write-through.
  useEffect(() => {
    const ids = Object.keys(pendingFlush);
    if (!ids.length) return;
    const timer = setTimeout(() => {
      for (const id of ids) {
        onUpdateReasoning(id, drafts[id]);
      }
      setPendingFlush({});
    }, 800);
    return () => clearTimeout(timer);
  }, [pendingFlush, drafts, onUpdateReasoning]);

  const setDraft = (id, value) => {
    setDrafts(prev => ({ ...prev, [id]: value }));
    setPendingFlush(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div>
      <StageHeader
        label="back to picking"
        onBack={onBack}
        title={`Why these ${picks.length}?`}
        subtitle="One line each. Optional, but it's the part people read." />

      {picks.map((p, i) => (
        <div key={p.rowId} style={{
          background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 8,
          padding: 14, marginBottom: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase",
                          letterSpacing: "0.04em", margin: "0 0 2px" }}>
                Pick {i + 1}
              </p>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text1)",
                          overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.brand} {p.ref || ""}
              </p>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", margin: 0, whiteSpace: "nowrap" }}>
              {fmtUSD(p.savedPriceUSD || p.priceUSD || 0)}
            </p>
          </div>
          <textarea value={drafts[p.rowId] ?? ""}
            onChange={e => setDraft(p.rowId, e.target.value)}
            onBlur={() => onUpdateReasoning(p.rowId, drafts[p.rowId] ?? "")}
            placeholder="Why this one?"
            rows={2}
            style={{
              width: "100%", boxSizing: "border-box",
              border: "0.5px solid var(--border)", borderRadius: 6,
              background: "var(--surface)", padding: "8px 10px",
              fontFamily: "inherit", fontSize: 13, color: "var(--text1)",
              resize: "vertical", outline: "none",
            }} />
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onFinish} style={{
          padding: "10px 18px", borderRadius: 8, border: "none",
          background: "#185FA5", color: "#fff", cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 500,
        }}>Finish challenge →</button>
      </div>
    </div>
  );
}

// ── Complete stage ──────────────────────────────────────────────────
function CompleteStage({ challenge, items, onShare, onBack }) {
  const picks = useMemo(() => items.filter(it => it.isPick), [items]);
  const totalSpend = picks.reduce((s, p) => s + (p.savedPriceUSD || p.priceUSD || 0), 0);
  const overBy = Math.max(0, totalSpend - challenge.budget);

  return (
    <div>
      <StageHeader label="back to challenges" onBack={onBack} title={challenge.name}
        subtitle={challenge.descriptionLong} />

      <div style={{
        background: "var(--card-bg)", borderRadius: 8, border: "0.5px solid var(--border)",
        padding: 18, marginBottom: 16,
      }}>
        <div style={{ textAlign: "center", borderBottom: "0.5px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase",
                      letterSpacing: "0.04em", margin: "0 0 4px" }}>
            Watch challenge · complete
          </p>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
            {fmtUSD(totalSpend)} of {fmtUSD(challenge.budget)}
            {overBy > 0 && <span style={{ color: "#c9a227" }}> · over by {fmtUSD(overBy)}</span>}
          </p>
        </div>
        {picks.map((p, i) => (
          <div key={p.rowId} style={{
            display: "grid", gridTemplateColumns: "60px 1fr", gap: 14,
            paddingBottom: 14, marginBottom: 14,
            borderBottom: i < picks.length - 1 ? "0.5px solid var(--border)" : "none",
          }}>
            <div style={{
              aspectRatio: "1", background: "var(--bg)", borderRadius: 4,
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {p.img ? (
                <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 22, color: "var(--text3)" }}>⌚</span>
              )}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase",
                          letterSpacing: "0.04em", margin: "0 0 2px" }}>
                Pick {i + 1} · {fmtUSD(p.savedPriceUSD || 0)}
              </p>
              <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 2px", color: "var(--text1)" }}>
                {p.brand} {p.ref || ""}
              </p>
              <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 6px" }}>
                {p.source}
              </p>
              <p style={{ fontSize: 13, color: "var(--text1)", margin: 0, lineHeight: 1.5,
                          fontStyle: p.reasoning ? "normal" : "italic", color: p.reasoning ? "var(--text1)" : "var(--text3)" }}>
                {p.reasoning || "(no reasoning given)"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onShare} style={{
          padding: "10px 18px", borderRadius: 8, border: "none",
          background: "#185FA5", color: "#fff", cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 500,
        }}>Share →</button>
      </div>
    </div>
  );
}

// ── Top-level orchestrator ──────────────────────────────────────────
export function ChallengeFlow({
  challenge, items,
  allListings, watchlist, hidden, primaryCurrency,
  collectionsApi,                  // useCollections() return value
  handleShare,                     // App.js share handler — called with the challenge URL
  onExit,                          // back to ChallengesList
}) {
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
    // eslint-disable-next-line
  }, [challenge?.state, challenge?.targetCount]);

  // ── Stage-specific handlers ────────────────────────────────
  const submitConfig = useCallback(async (config) => {
    await collectionsApi.updateChallenge(challenge.id, config);
    setStage("picking");
  }, [challenge.id, collectionsApi]);

  const placeInSlot = useCallback(async (item, slotIdx) => {
    // Promote the dragged item to is_pick=true. If there's already an
    // item in that slot, demote it back to shortlist. Slot index is
    // implicit — picks list is filtered in render order, so we don't
    // store slot positions explicitly.
    const picks = items.filter(it => it.isPick);
    const currentOccupant = picks[slotIdx];
    if (currentOccupant && currentOccupant.rowId !== item.rowId) {
      await collectionsApi.togglePickStatus(currentOccupant.rowId, false, currentOccupant);
    }
    await collectionsApi.togglePickStatus(item.rowId, true, item);
  }, [items, collectionsApi]);

  const moveToShortlist = useCallback(async (item) => {
    if (item._remove) {
      // Remove from collection entirely.
      await collectionsApi.removeItemFromCollection(challenge.id, item.id);
      return;
    }
    await collectionsApi.togglePickStatus(item.rowId, false, item);
  }, [challenge.id, collectionsApi]);

  const addToShortlist = useCallback(async (listing) => {
    await collectionsApi.addToShortlist(challenge.id, listing);
  }, [challenge.id, collectionsApi]);

  const completeChallenge = useCallback(async () => {
    await collectionsApi.updateChallenge(challenge.id, { state: "complete" });
    setStage("complete");
  }, [challenge.id, collectionsApi]);

  const updateReasoning = useCallback(async (rowId, reasoning) => {
    await collectionsApi.updateReasoning(rowId, reasoning);
  }, [collectionsApi]);

  const shareChallenge = useCallback(() => {
    if (!handleShare) return;
    // v1 shares the challenge SPEC (not the picks themselves) so the
    // recipient can build their own response under the same constraints
    // — Mark's "send-as-empty challenge" mode. Encoding in URL avoids
    // RLS-public-read schema surgery; v2 will swap to a real public
    // landing page for "see my picks" sharing.
    const params = new URLSearchParams();
    params.set("newchallenge", "1");
    if (challenge.name)             params.set("t", challenge.name);
    if (challenge.targetCount)      params.set("n", String(challenge.targetCount));
    if (challenge.budget)           params.set("b", String(challenge.budget));
    if (challenge.descriptionLong)  params.set("d", challenge.descriptionLong);
    const url = `${window.location.origin}/?${params.toString()}`;
    handleShare({ title: `Watch challenge: ${challenge.name}`, url });
  }, [challenge.id, challenge.name, challenge.targetCount, challenge.budget, challenge.descriptionLong, handleShare]);

  // ── Render the active stage ────────────────────────────────
  if (stage === "create") {
    return (
      <CreateStage challenge={challenge}
        onSubmit={submitConfig}
        onCancel={onExit} />
    );
  }
  if (stage === "complete") {
    return (
      <CompleteStage challenge={challenge} items={items}
        onShare={shareChallenge}
        onBack={onExit} />
    );
  }
  if (stage === "reasoning") {
    return (
      <ReasoningStage challenge={challenge} items={items}
        onUpdateReasoning={updateReasoning}
        onBack={() => setStage("picking")}
        onFinish={completeChallenge} />
    );
  }
  // Default: picking
  return (
    <PickingStage
      challenge={challenge} items={items}
      allListings={allListings} watchlist={watchlist} hidden={hidden}
      primaryCurrency={primaryCurrency}
      onPlaceInSlot={placeInSlot}
      onMoveToShortlist={moveToShortlist}
      onAddToShortlist={addToShortlist}
      onComplete={() => {
        // From picking, jump to reasoning (let the user write
        // rationales) before flipping state to 'complete'.
        setStage("reasoning");
      }}
      onEditConfig={() => setStage("create")}
      onBack={onExit}
    />
  );
}

// Convenience helper — quick check for whether a collection IS a
// challenge. Used by WatchlistTab to filter the Collections list.
export function isChallenge(collection) {
  return collection?.type === "challenge";
}
