import React, { useState, useEffect, useCallback } from "react";
import { Modal, FieldLabel, Button, Select } from "../ui";
import { confirm } from "./ConfirmModal";

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

  // Single-step "invite and share". Creates the pending invite row
  // (idempotent — re-uses an existing pending invite for the same
  // email), then opens the OS share sheet (or clipboard fallback)
  // with a personalised share URL that carries `?invite=<id>` so the
  // receiver page can accept on click without needing the invitee's
  // sign-in email to match what the owner typed. Was previously two
  // separate buttons (Invite, then Copy invite link); the split
  // confused users and several invites went out without the link
  // being sent.
  const submitInvite = useCallback(async () => {
    if (!collection?.id) return;
    const trimmed = (email || "").trim();
    if (!trimmed) { setError("Email required"); return; }
    setBusy(true);
    setError("");
    const res = await inviteCollaborator(collection.id, trimmed, role);
    if (res?.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    const inviteId = res?.id;
    // Collaborate links route through /share/list_<id> too (P-23) so the
    // invite ALSO previews as the list; api/share.js passes the invite
    // token through to the ?list= redirect unchanged.
    const shareU = new URL(`${window.location.origin}/share/${encodeURIComponent(`list_${collection.id}`)}`);
    shareU.searchParams.set("t", collection.name || "A list");
    if (inviteId) shareU.searchParams.set("invite", inviteId);
    const url = shareU.toString();
    let outcome = "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${collection.name}: Watchlist`,
          text: `I'd like to share "${collection.name}" with you on Watchlist. Tap the link to join:`,
          url,
        });
        outcome = "shared-collab";
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        outcome = "copied-collab";
      } else {
        window.prompt("Copy this link and send it to them:", url);
        outcome = "copied-collab";
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        try { await navigator.clipboard?.writeText(url); outcome = "copied-collab"; }
        catch { window.prompt("Copy this link and send it to them:", url); outcome = "copied-collab"; }
      } // AbortError = user dismissed share sheet; treat as no-op, invite still created.
    }
    setBusy(false);
    setShareCopyState(outcome);
    setEmail("");
    refresh();
    // Keep the confirmation visible long enough to actually be read —
    // 2.4s was the prior default but Mark feedback (2026-05-09):
    // desktop-clipboard "copied" felt too brief. 4s gives a calm read.
    setTimeout(() => setShareCopyState(""), 4000);
  }, [collection?.id, collection?.name, email, role, inviteCollaborator, refresh]);

  const onRevoke = useCallback(async (row) => {
    if (!collection?.id) return;
    const label = row.user_email || row.invited_email;
    if (!(await confirm({
      title: "Remove from list?",
      message: `${label} will lose access to this list.`,
      confirmLabel: "Remove",
      tone: "danger",
    }))) return;
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

  // Generic list-share link (no invite token) for sharing a list
  // read-only. Used when no email is in the invite field — the
  // recipient gets a "Save a copy" experience rather than collaborator
  // access. With an email + invite token (submitInvite), the receiver
  // page can accept directly.
  const copyShareUrl = useCallback(async () => {
    if (!collection?.id) return;
    // Routed through /share/list_<id> (P-23) so the preview card carries the
    // list's name — same treatment as triggerShare + submitInvite.
    const shareU = new URL(`${window.location.origin}/share/${encodeURIComponent(`list_${collection.id}`)}`);
    shareU.searchParams.set("t", collection.name || "A list");
    const url = shareU.toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${collection.name}: Watchlist`,
          text: `${collection.name}: a list on Watchlist`,
          url,
        });
        setShareCopyState("shared-readonly");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareCopyState("copied-readonly");
      } else {
        window.prompt("Copy this link:", url);
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        try { await navigator.clipboard?.writeText(url); setShareCopyState("copied-readonly"); }
        catch { window.prompt("Copy this link:", url); }
      }
    }
    setTimeout(() => setShareCopyState(""), 4000);
  }, [collection?.id, collection?.name]);

  if (!open || !collection) return null;

  // Two clearly-separated sections = the two share MODES (Mark 2026-06-02):
  // "Send a copy" as a single primary CTA at the top (plain link → recipient
  // saves their own editable copy), then "Collaborate" with the email invite
  // form + roster (invite-token link → recipient joins the synced list). The
  // labels mirror the recipient surface's two clearly-labelled outcomes.
  return (
    <Modal title={`Share "${collection.name}"`} onClose={onClose} locked={busy} width={480}>

        {/* Two-mode share (Mark 2026-06-02). The sender's two sections mirror
            the recipient's two clearly-labelled outcomes:
              Section 1 "Send a copy"  → plain link → recipient saves their OWN
                editable copy into Your lists.
              Section 2 "Collaborate"  → invite-token link → recipient JOINS the
                synced list under Shared with you. */}
        {/* Section 1 — Send a copy. Single big CTA. */}
        <FieldLabel>Send a copy</FieldLabel>
        <Button primary block onClick={copyShareUrl} disabled={busy} style={{ marginBottom: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          {shareCopyState === "copied-readonly" ? "Link copied to clipboard ✓"
           : shareCopyState === "shared-readonly" ? "Shared ✓"
           : "Share a copy of this list"}
        </Button>
        <div style={{
          fontSize: 11, color: "var(--text3)",
          marginBottom: 22, lineHeight: 1.5,
        }}>
          Anyone with the link can preview it; they sign in to save their own
          editable copy. Your list stays separate; changes don't sync.
        </div>

        {/* Section 2 — Collaborate (invite form + roster). */}
        <FieldLabel>Collaborate</FieldLabel>
        <div style={{
          padding: 12, borderRadius: 10,
          border: "0.5px solid var(--border)", background: "var(--card-bg)",
          marginBottom: 14,
        }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") submitInvite(); }}
              placeholder="name@example.com"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className="ui-input" />
            <Select value={role} onChange={e => setRole(e.target.value)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>
          <Button small block onClick={submitInvite} disabled={busy || !email.trim()}>
            {busy ? "Sending…"
             : shareCopyState === "copied-collab" ? "Invite copied to clipboard ✓"
             : shareCopyState === "shared-collab" ? "Sent ✓"
             : "Send invite"}
          </Button>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, lineHeight: 1.5 }}>
            You'll share one synced list. It shows up under their Lists ▸ Shared
            with you. Editors add and remove watches; viewers see read-only.
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>{error}</div>}

        {/* Roster */}
        <FieldLabel>Collaborators ({rows.length})</FieldLabel>
        {loading && <div style={{ fontSize: 12, color: "var(--text3)" }}>Pulling collaborators…</div>}
        {loadError && <div style={{ fontSize: 12, color: "var(--danger)" }}>{loadError}</div>}
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
                  <Button link danger small onClick={() => onRevoke(r)} disabled={busy} title="Remove access">Remove</Button>
                </div>
              );
            })}
          </div>
        )}
    </Modal>
  );
}
