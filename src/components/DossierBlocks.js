import React, { useState } from "react";
import { useCollectionBlocks, useSearches } from "../supabase";
import { Pill, Button, PickRow } from "../ui";
import {
  REFERENCE_NODES,
  REFERENCE_NODES_BY_ID,
} from "../data/referencePages";

// DossierBlocks — the composable "living dossier" layer for a list (Watchlists;
// docs/WATCHLISTS_DOSSIER_SPEC.md). The user adds ordered blocks (Notion-style):
//   note · reference_guide · saved_search (live preview)
// The list's saved watches + articles still render from the existing
// collection_items grid below this; these blocks compose on top. Self-contained:
// owns its data via useCollectionBlocks + reads the user's favourite searches via
// useSearches, so CollectionsTab just mounts it with a collectionId.

export function matchListings(allListings, query, minP, maxP) {
  const tokens = (query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return (allListings || [])
    .filter((it) => {
      if (!it) return false;
      const hay = `${it.brand || ""} ${it.title || ""} ${it.model || ""} ${
        it.model_line || ""
      } ${it.reference_no || it.ref || ""}`.toLowerCase();
      if (!tokens.every((t) => hay.includes(t))) return false;
      const price = Number(it.priceUSD ?? it.price_usd ?? it.price ?? NaN);
      if (minP != null && Number.isFinite(price) && price < minP) return false;
      if (maxP != null && Number.isFinite(price) && price > maxP) return false;
      return true;
    })
    .slice(0, 12);
}

const card = {
  border: "0.5px solid var(--border)",
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
};
const eyebrow = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text3)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
export function DossierBlocks({
  collectionId,
  user,
  allListings = [],
  canEdit = false,
  onClickListing,
}) {
  const { blocks, addBlock, removeBlock, updateNote, move } =
    useCollectionBlocks(collectionId, user);
  const { items: savedSearches } = useSearches(user);
  const [adding, setAdding] = useState(null); // null | 'reference_guide' | 'saved_search'

  const liveNodes = REFERENCE_NODES; // include coming-soon (they're real references)

  if (!blocks.length && !canEdit) return null;

  const blockControls = (b, i) => {
    if (!canEdit) return null;
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <Button link icon title="Move up" aria-label="Move up" disabled={i === 0}
          onClick={() => move(b.id, "up")}>↑</Button>
        <Button link icon title="Move down" aria-label="Move down" disabled={i === blocks.length - 1}
          onClick={() => move(b.id, "down")}>↓</Button>
        <Button link icon title="Remove block" aria-label="Remove block"
          onClick={() => removeBlock(b.id)}>×</Button>
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 18 }}>
      {blocks.map((b, i) => (
        <div key={b.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={eyebrow}>
              {b.kind === "note" ? "Note"
                : b.kind === "reference_guide" ? "Reference guide"
                : b.kind === "saved_search" ? "Saved search"
                : b.kind}
            </span>
            {blockControls(b, i)}
          </div>
          {b.kind === "note" && (
            <NoteBlock block={b} canEdit={canEdit} onSave={(t) => updateNote(b.id, t)} />
          )}
          {b.kind === "reference_guide" && (
            <ReferenceGuideBlock referenceId={b.referenceId} />
          )}
          {b.kind === "saved_search" && (
            <SavedSearchBlock
              search={savedSearches.find((s) => s.id === b.savedSearchId)}
              allListings={allListings}
              onClickListing={onClickListing}
            />
          )}
        </div>
      ))}

      {canEdit && (
        <AddBlockBar
          adding={adding}
          setAdding={setAdding}
          savedSearches={savedSearches}
          referenceNodes={liveNodes}
          onAdd={(kind, fields) => { addBlock(kind, fields); setAdding(null); }}
        />
      )}
    </div>
  );
}

function NoteBlock({ block, canEdit, onSave }) {
  const [text, setText] = useState(block.noteText || "");
  if (!canEdit) {
    return block.noteText ? (
      <div style={{ fontSize: 13, color: "var(--text1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
        {block.noteText}
      </div>
    ) : (
      <div style={{ fontSize: 13, color: "var(--text3)" }}>Empty note.</div>
    );
  }
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text !== (block.noteText || "")) onSave(text); }}
      placeholder="Your notes about this list…"
      rows={3}
      style={{
        width: "100%", boxSizing: "border-box", resize: "vertical",
        fontFamily: "inherit", fontSize: 13, lineHeight: 1.5, color: "var(--text1)",
        background: "transparent", border: "0.5px solid var(--border)", borderRadius: 8, padding: 8,
      }}
    />
  );
}

function ReferenceGuideBlock({ referenceId }) {
  const node = REFERENCE_NODES_BY_ID[referenceId];
  if (!node) {
    return <div style={{ fontSize: 13, color: "var(--text3)" }}>Reference not found.</div>;
  }
  const href = `/?tab=learn&sub=references&ref=${encodeURIComponent(node.id)}`;
  return (
    <a href={href} style={{ textDecoration: "none", display: "block" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text1)" }}>
        {node.brand} {node.modelLine} · {node.group || (node.refs || []).join(" / ")}
      </div>
      {node.definer && (
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.4, marginTop: 4 }}>
          {node.definer}
        </div>
      )}
      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6 }}>Open guide →</div>
    </a>
  );
}

function SavedSearchBlock({ search, allListings, onClickListing }) {
  if (!search) {
    return <div style={{ fontSize: 13, color: "var(--text3)" }}>This saved search was removed.</div>;
  }
  const matches = matchListings(allListings, search.query, search.minPrice, search.maxPrice);
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)" }}>{search.label}</div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>
        “{search.query}” · {matches.length} live match{matches.length === 1 ? "" : "es"}
      </div>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text3)" }}>No live listings match right now.</div>
      ) : (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {matches.map((it) => (
            <a
              key={it.id || it.url}
              href={it.url}
              onClick={() => onClickListing && onClickListing(it)}
              style={{ flex: "0 0 auto", width: 104, textDecoration: "none" }}
            >
              <div style={{
                width: 104, height: 104, borderRadius: 8, overflow: "hidden",
                background: "var(--border)", marginBottom: 4,
              }}>
                {it.img && (
                  <img src={it.img} alt="" loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div style={{
                fontSize: 11, color: "var(--text1)", lineHeight: 1.3,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {it.title || `${it.brand || ""} ${it.reference_no || ""}`.trim()}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AddBlockBar({ adding, setAdding, savedSearches, referenceNodes, onAdd }) {
  if (adding === "reference_guide") {
    return (
      <PickerRow
        label="Pick a reference"
        options={referenceNodes.map((n) => ({
          value: n.id,
          label: `${n.brand} ${n.modelLine} · ${n.group || (n.refs || []).join(" / ")}`,
        }))}
        onPick={(value) => onAdd("reference_guide", { referenceId: value })}
        onCancel={() => setAdding(null)}
        emptyHint="No references available."
      />
    );
  }
  if (adding === "saved_search") {
    return (
      <PickerRow
        label="Pick a saved search"
        options={(savedSearches || []).map((s) => ({ value: s.id, label: s.label }))}
        onPick={(value) => onAdd("saved_search", { savedSearchId: value })}
        onCancel={() => setAdding(null)}
        emptyHint="No saved searches yet. Save one from the search bar first."
      />
    );
  }
  // Compact pill row (P-20, 2026-06-03 — was three full-width boxed rows
  // that ate the top of every list before its actual content; Mark: the
  // populated things should come first, not the add options). One quiet
  // line; the empty-list onboarding keeps its big boxed rows.
  const rows = [
    { icon: "✎", label: "Note", go: () => onAdd("note", { noteText: "" }) },
    { icon: "📖", label: "Reference guide", go: () => setAdding("reference_guide") },
    { icon: "🔍", label: "Saved search", go: () => setAdding("saved_search") },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
        textTransform: "uppercase", color: "var(--text3)", marginRight: 2,
      }}>Add</span>
      {rows.map((r) => (
        <Pill key={r.label} onClick={r.go} title={`Add a ${r.label.toLowerCase()}`}>
          <span aria-hidden>{r.icon}</span>
          {r.label}
          <span aria-hidden>＋</span>
        </Pill>
      ))}
    </div>
  );
}

function PickerRow({ label, options, onPick, onCancel, emptyHint }) {
  return (
    <div style={{ ...card, marginTop: 4 }}>
      <div style={{ ...eyebrow, marginBottom: 8 }}>{label}</div>
      {options.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8 }}>{emptyHint}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {options.map((o) => (
            <PickRow key={o.value} onClick={() => onPick(o.value)}>{o.label}</PickRow>
          ))}
        </div>
      )}
      <Button link onClick={onCancel}>Cancel</Button>
    </div>
  );
}
