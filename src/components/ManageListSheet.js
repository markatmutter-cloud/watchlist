import React, { useState, useEffect, useCallback } from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow, modalTitle } from "../styles";

// List Sharing v2 / slice 2 — Manage list sheet.
//
// Opens from the list drill-in (Saved > Lists > [list]) when the
// owner taps "Manage". Shows current collaborators + pending invites
// on this list, with an inline form to invite by email.
//
// The Manage sheet is OWNER-ONLY — collaborator-editors can add /
// remove items but can't see this surface or invite others.
//
// Mark's no-notifications rule still applies: invitees see new
// invites via the in-app pending-invite badge (slice 3) plus an
// out-of-band link the owner shares (the URL is a deep link to the
// list — slice 1's read-only flow handles that until the invitee
// signs in and accepts).

export function ManageListSheet({
  open, onClose,
  user,
  collection,                 // the list being managed (id, name)
  inp,
  // Mutators threaded from collectionsApi.
  inviteCollaborator,         // (collectionId, email, role) => { error, id }
  revokeCollaborator,         // (collectionId, opts) => { error }
  listCollaborators,          // (collectionId) => { error, rows }
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareCopyState, setShareCopyState] = useState(""); // "" | "copied" | "shared"

  const refresh = useCallback(async () => {
    if (!collection?.id || !listCollaborators) return;
    setLoading(true);
    setLoadError("");
    const res = await listCollaborators(collection.id);
    setLoading(false);
    if (res?.error) { setLoadError(res.error); return; }
    setRows(res?.rows || []);
  }, [collection?.id, listCollaborators]);

  // Re-fetch on open + on collection change.
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Reset transient state on close.
  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("editor");
      setError("");
      setShareCopyState("");
    }
  }, [open]);

  const submitInvite = useCallback(async () => {
    if (!collection?.id) return;
    const trimmed = (email || "").trim();
    if (!trimmed) { setError("Email required"); return; }
    setBusy(true);
    setError("");
    const res = await inviteCollaborator(collection.id, trimmed, role);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setEmail("");
    refresh();
  }, [collection?.id, email, role, inviteCollaborator, refresh]);

  const onRevoke = useCallback(async (row) => {
    if (!collection?.id) return;
    const label = row.user_email || row.invited_email;
    if (!window.confirm(`Remove ${label}? They'll lose access to this list.`)) return;
    setBusy(true);
    setError("");
    const opts = row.user_id ? { userId: row.user_id } : { inviteId: row.invite_id };
    const res = await revokeCollaborator(collection.id, opts);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    refresh();
  }, [collection?.id, revokeCollaborator, refresh]);

  // Copy the list-share URL so the owner can paste it into the
  // invitee's preferred messaging tool. Mark's no-in-app-notifications
  // rule (CLAUDE.md) means we don't send the invite email ourselves
  // — the owner shares the link via iMessage / WhatsApp / wherever.
  const copyShareUrl = useCallback(async () => {
    if (!collection?.id) return;
    const url = `${window.location.origin}/?list=${encodeURIComponent(collection.id)}&shared=1`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${collection.name} — Watchlist`,
          text: `${collection.name} — a list on Watchlist`,
          url,
        });
        setShareCopyState("shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareCopyState("copied");
      } else {
        window.prompt("Copy this link:", url);
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        try { await navigator.clipboard?.writeText(url); setShareCopyState("copied"); }
        catch { window.prompt("Copy this link:", url); }
      }
    }
    setTimeout(() => setShareCopyState(""), 2400);
  }, [collection?.id, collection?.name]);

  if (!open || !collection) return null;

  return (
    <div onClick={busy ? undefined : onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell, maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={modalTitleRow}>
          <div style={modalTitle}>Manage "{collection.name}"</div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}
                  disabled={busy}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14, lineHeight: 1.5 }}>
          Invite people by email. They'll see the list under their Saved &gt; Lists once they
          accept. Editors can add and remove items; viewers can only see.
        </div>

        {/* Invite form */}
        <div style={{
          padding: 12, borderRadius: 10,
          border: "0.5px solid var(--border)", background: "var(--card-bg)",
          marginBottom: 14,
        }}>
          <Label>Invite by email</Label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") submitInvite(); }}
              placeholder="name@example.com"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ ...inp, fontSize: 14, flex: 1 }} />
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{
                fontSize: 13, fontFamily: "inherit",
                padding: "8px 10px", borderRadius: 8,
                border: "0.5px solid var(--border)",
                background: "var(--surface)", color: "var(--text1)",
              }}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button onClick={copyShareUrl}
              disabled={busy}
              style={{
                border: "0.5px solid var(--border)", background: "transparent",
                color: "var(--text2)", padding: "6px 12px", borderRadius: 6,
                cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 12,
              }}>
              {shareCopyState === "copied" ? "Link copied ✓"
               : shareCopyState === "shared" ? "Shared ✓"
               : "Copy invite link"}
            </button>
            <button onClick={submitInvite} disabled={busy || !email.trim()}
              style={{
                border: "none", background: "#185FA5", color: "#fff",
                padding: "6px 14px", borderRadius: 6,
                cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                opacity: (!email.trim() || busy) ? 0.5 : 1,
              }}>
              {busy ? "Sending…" : "Invite"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, lineHeight: 1.4 }}>
            We don't send the invite email — copy the link with the button above and paste it
            into iMessage / WhatsApp / wherever they'll see it. Once they sign in with the
            invited email, the invite shows up in their account.
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 10 }}>{error}</div>}

        {/* Roster */}
        <Label>Collaborators ({rows.length})</Label>
        {loading && <div style={{ fontSize: 12, color: "var(--text3)" }}>Loading…</div>}
        {loadError && <div style={{ fontSize: 12, color: "#c0392b" }}>{loadError}</div>}
        {!loading && rows.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text3)", padding: "10px 0" }}>
            No collaborators yet. Invite someone above.
          </div>
        )}
        {rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map(r => {
              const label = r.user_name || r.user_email || r.invited_email;
              const isPending = r.status === 'pending';
              return (
                <div key={r.invite_id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: "var(--card-bg)",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: "var(--text1)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>
                      {isPending ? "Pending" : "Accepted"} · {r.role === 'viewer' ? "Viewer" : "Editor"}
                    </div>
                  </div>
                  <button onClick={() => onRevoke(r)} disabled={busy}
                    title="Remove access"
                    style={{
                      border: "none", background: "transparent",
                      color: "#c0392b", cursor: busy ? "wait" : "pointer",
                      padding: "4px 10px", borderRadius: 6,
                      fontFamily: "inherit", fontSize: 12,
                    }}>Remove</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: "var(--text3)",
      textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 6,
    }}>{children}</div>
  );
}
