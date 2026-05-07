import React from "react";
import { modalBackdrop, modalShell, modalCloseButton, modalTitleRow } from "../styles";
import { buildFeedbackMailto, captureFeedbackContext } from "../utils";

// AboutModal doubles as the welcome surface (first-visit auto-open) and
// the About surface (always accessible from the header info icon + the
// Settings > About & Contact entry). Same content, two access paths.
//
// Copy is intentionally collector-voiced — no "aggregator", no hard
// dealer/house counts (so the copy doesn't go stale as sources are
// added/pruned), and the privacy line is present-tense first-person
// ("I don't sell data, I don't run ads") rather than the harder
// "never" claim.
//
// 2026-05-07 redesign expanded the modal from a 5-line about-blurb
// into the welcome page. Old Get-in-touch Instagram link is preserved;
// added a feedback mailto for "suggest a dealer / report a bug / send
// feedback" per Mark's reachout brief. The mailto auto-fills current
// URL, currency, and browser into the body so reporters don't have to
// type the surface every time. See `buildFeedbackMailto` in utils.js
// for the shared helper used here and from the user-dropdown
// "Report a bug" entry.

const sectionLabel = {
  fontSize: 11, fontWeight: 600, color: "var(--text3)",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginTop: 18, marginBottom: 8,
};

const bodyText = {
  fontSize: 13, color: "var(--text2)", lineHeight: 1.6,
};

const bullet = {
  ...bodyText,
  marginBottom: 8,
};

const linkButton = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "8px 14px", borderRadius: 8,
  border: "0.5px solid var(--border)", background: "var(--card-bg)",
  color: "var(--text1)", textDecoration: "none",
  fontFamily: "inherit", fontSize: 14, fontWeight: 500,
};

export function AboutModal({ open, onClose, primaryCurrency }) {
  if (!open) return null;
  const feedbackMailto = buildFeedbackMailto({
    contextLines: captureFeedbackContext({ primaryCurrency }),
  });
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell, maxWidth: 520, maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={modalTitleRow}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text1)" }}>
            Vintage watches, in one feed
          </div>
          <button onClick={onClose} aria-label="Close" style={modalCloseButton}>×</button>
        </div>

        <div style={bodyText}>
          Most vintage watch collectors know the problem — the dealers worth
          following all run their own sites, in their own currencies, in no
          consistent order, sometimes without prices, and the right one for
          you appears once a quarter. So you bookmark, you text links, you
          start notes, you forget where that Ed White was, and you check again.
        </div>
        <div style={{ ...bodyText, marginTop: 10 }}>
          This is a tool to lift that load.
        </div>

        <div style={sectionLabel}>What you can do</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={bullet}>
            <strong style={{ color: "var(--text1)" }}>Browse</strong> active
            inventory from independent dealers and lots from the major auctions
            in one feed, updated multiple times a day.
          </li>
          <li style={bullet}>
            <strong style={{ color: "var(--text1)" }}>Save</strong> anything
            you want to come back to. Build lists for references you're
            hunting, watches you're sharing with someone, or a trip you're
            planning.
          </li>
          <li style={bullet}>
            <strong style={{ color: "var(--text1)" }}>Plan</strong> your
            collection — track what you own, what you've sold, what you'd add.
            Play with budgets and tradeoffs.
          </li>
          <li style={bullet}>
            <strong style={{ color: "var(--text1)" }}>Learn</strong> about
            references from the best writers and dealers in the watch world,
            in one place.
          </li>
          <li style={bullet}>
            <strong style={{ color: "var(--text1)" }}>Discover</strong> watches
            you'd never have found on your own.
          </li>
        </ul>

        <div style={sectionLabel}>A passion project, open to anyone</div>
        <div style={bodyText}>
          Built by a collector — a non-technical PM seeing how far you can get
          vibe-coding with AI as a co-author. Every listing links back to the
          original dealer; this is a directory layer, not a marketplace.
        </div>
        <div style={{ ...bodyText, marginTop: 10 }}>
          No ads, no tracking, no fees. Saves and likes help build a
          recommender that learns your taste — they stay yours. I don't sell
          data and I don't run ads.
        </div>

        <div style={sectionLabel}>Get in touch</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="https://instagram.com/lagunabeachwatch" target="_blank" rel="noopener noreferrer" style={linkButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            @lagunabeachwatch
          </a>
          <a href={feedbackMailto} style={linkButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Suggest a dealer · Report a bug · Feedback
          </a>
        </div>
      </div>
    </div>
  );
}
