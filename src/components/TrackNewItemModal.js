import React from "react";
import { Modal, ModalNote, ModalFoot, Input, Button } from "../ui";

// Track new item modal — single-URL paste flow with source-list
// instructions. Lifted out of App.js on 2026-04-30 (was an inline JSX
// const next to favSearchModalJSX). Takes its trigger state and submit
// handler as props so the parent owns the URL state machine.
export function TrackNewItemModal({
  open, setOpen,
  trackUrl, setTrackUrl,
  trackError, setTrackError,
  submitTrack, trackBusy,
}) {
  if (!open) return null;
  return (
    <Modal title="Track eBay item" onClose={() => setOpen(false)} width={520}>
      <ModalNote>
        Paste an eBay item URL. The tracked item appears in your
        Favorites and refreshes on the next scrape (current bid,
        hammer price, end time).
      </ModalNote>
      <p className="ui-modal-note" style={{ fontSize: 11, color: "var(--text3)" }}>
        For auction-house lots (Antiquorum, Christie's, Sotheby's,
        Phillips, Watches of Knightsbridge, Marteau & Co), heart them
        directly from the main feed; they're scraped automatically
        every day.
      </p>
      <Input
        autoFocus
        value={trackUrl}
        onChange={e => { setTrackUrl(e.target.value); setTrackError(""); }}
        onKeyDown={e => { if (e.key === "Enter") submitTrack(); }}
        placeholder="https://..."
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {trackError && <p className="ui-modal-error" style={{ marginTop: 8 }}>{trackError}</p>}
      <p className="ui-modal-note" style={{ fontSize: 11, color: "var(--text3)", marginTop: 10, marginBottom: 0 }}>
        Supported: eBay item URLs, auction or Buy-It-Now, any region
        (.com, .co.uk, .de, .fr, .it, .es, .nl, .at, .ch, .ca,
        .com.au) plus eBay's short share links (ebay.us / ebay.gg /
        ebay.to).
      </p>
      <ModalFoot>
        <Button small onClick={() => setOpen(false)}>Cancel</Button>
        <Button small primary onClick={submitTrack} disabled={trackBusy || !trackUrl.trim()}>
          {trackBusy ? "Tracking…" : "Track"}
        </Button>
      </ModalFoot>
    </Modal>
  );
}
