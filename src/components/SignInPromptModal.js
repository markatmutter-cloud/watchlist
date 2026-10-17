import React from "react";
import { Modal, ModalLabel, Button } from "../ui";

// Sign-in 2-step explainer. Replaces the cold-OAuth flow on the top-bar
// Sign in button with a brief "what sign-in unlocks + privacy reassurance"
// modal first. The modal's primary button fires the actual signInWithGoogle
// call.
//
// Scoped to the top-bar Sign in button only — contextual sign-in CTAs in
// the share/challenge receivers and the per-feature signed-out prompts
// already carry their own explanatory copy and fire signInWithGoogle
// directly. Adding this modal there would be redundant.
//
// 2026-05-07 copy fix: "What sign-in adds" reads as if it's about
// inserting ads (Mark feedback) — replaced with "Why sign in". Contact
// line switched from email to Instagram (Mark's preferred reachout
// channel; the feedback link in the AboutModal still carries the
// contextualized mailto for bug reports that benefit from URL/currency
// auto-fill).

const INSTAGRAM_HANDLE = "the_watch_list.app";
const INSTAGRAM_URL = "https://instagram.com/the_watch_list.app";

export function SignInPromptModal({ open, onClose, onSignIn }) {
  // Escape closes (B-63, audit:2026-06-06 U-08): the Modal owns that now.
  if (!open) return null;
  return (
    <Modal title="Sign in to Watchlist" onClose={onClose} width={420}>
      <p className="ui-modal-note" style={{ marginBottom: 6, lineHeight: 1.6 }}>
        Sign in with Google to unlock features: saving listings and searches
        across devices. Watchlist is free, and you can keep browsing without
        an account.
      </p>

      <ModalLabel>Why sign in</ModalLabel>
      <ul className="ui-modal-note" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
        <li>Save listings, build lists, plan your collection</li>
        <li>Save searches and re-run them with one tap</li>
        <li>Share watches and lists with friends and family</li>
        <li>Sync everything across your devices</li>
      </ul>

      <ModalLabel>What it doesn't do</ModalLabel>
      <p className="ui-modal-note" style={{ lineHeight: 1.6 }}>
        No ads, no tracking, no fees. I don't sell data and I don't run
        ads. Questions:{" "}
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text1)" }}>
          @{INSTAGRAM_HANDLE}
        </a>.
      </p>

      <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
        <Button primary block onClick={() => { onSignIn(); onClose(); }}>
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.1 30.1 0 24 0 14.8 0 6.8 5.3 3 13l7.8 6C12.7 13.5 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.2-3.1-.5-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z"/>
              <path fill="#FBBC05" d="M10.8 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6C1.1 16.3 0 20 0 24s1.1 7.7 3 11.2l7.8-6.5z"/>
              <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.6-5.9c-2.1 1.4-4.8 2.2-7.5 2.2-6.2 0-11.3-4-13.2-9.5l-7.8 6C6.8 42.7 14.8 48 24 48z"/>
            </svg>
          Continue with Google
        </Button>
        <Button block small onClick={onClose}>Keep browsing without an account</Button>
      </div>
    </Modal>
  );
}
