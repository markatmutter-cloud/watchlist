import React from "react";
import { modalBackdrop, modalShell, modalCloseButton } from "../styles";
import { buildFeedbackMailto, captureFeedbackContext } from "../utils";

// AboutModal doubles as the welcome surface (first-visit auto-open) and
// the always-on About surface (header dropdown entry). Same content,
// two access paths.
//
// 2026-05-07 redesign #2 (Mark feedback on Bundle 1):
//   - Hero heading "Welcome to Watchlist" with hourglass glyph so
//     newcomers see the product name front-and-center.
//   - Wider on desktop (720) so the content fits without scrolling on
//     a typical laptop viewport. Mobile still scrolls when needed.
//   - Intro paragraph condensed from ~5 lines to ~3.
//   - Feature list rendered as a 2-column visual grid with verb-first
//     anchors instead of a flat bullet list — reads less like a wall
//     of text.
//   - "Get started →" primary CTA at the bottom alongside the close
//     button so newcomers have an action to take, not just an X.
//   - Privacy line: present-tense first-person ("I don't sell data,
//     I don't run ads"), not the harder "never" claim.
//   - "Get in touch" leads with Instagram (which Mark prefers as a
//     contact channel and can handle bug reports too); mailto stays
//     as the secondary feedback link because it auto-fills URL +
//     currency + UA into the body so the reporter doesn't have to
//     type the surface every time. See `buildFeedbackMailto` in
//     utils.js for the shared helper.

const HOURGLASS = "⌛";

const sectionLabel = {
  fontSize: 11, fontWeight: 600, color: "var(--text3)",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginTop: 18, marginBottom: 10,
};

const bodyText = {
  fontSize: 13, color: "var(--text2)", lineHeight: 1.55,
};

const linkButton = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "8px 14px", borderRadius: 8,
  border: "0.5px solid var(--border)", background: "var(--card-bg)",
  color: "var(--text1)", textDecoration: "none",
  fontFamily: "inherit", fontSize: 14, fontWeight: 500,
};

const featureCard = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "0.5px solid var(--border)",
  background: "var(--surface)",
  display: "flex", flexDirection: "column", gap: 4,
};

const featureVerb = {
  fontSize: 13, fontWeight: 600, color: "var(--text1)",
  display: "flex", alignItems: "center", gap: 6,
};

const featureCopy = {
  fontSize: 12, color: "var(--text2)", lineHeight: 1.45,
};

const FEATURES = [
  ["Browse", "Active inventory from independent dealers and lots from the major auctions, in one feed updated multiple times a day."],
  ["Save",   "Heart anything you want to come back to. Build lists for references you're hunting or for sharing."],
  ["Plan",   "Track what you own, what you've sold, and what you'd add. Play with budgets and tradeoffs."],
  ["Learn",  "Reference guides synthesized from the best writers and dealers in the watch world."],
  ["Discover", "Watches you'd never have stumbled on yourself."],
];

export function AboutModal({ open, onClose, primaryCurrency }) {
  if (!open) return null;
  const feedbackMailto = buildFeedbackMailto({
    contextLines: captureFeedbackContext({ primaryCurrency }),
  });
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell,
        maxWidth: 720,
        // Mobile keeps overflow scrolling for narrow viewports; on
        // desktop the 720px width is enough to fit the full content
        // without a vertical scroll on a typical laptop (~1080px).
        maxHeight: "88vh",
        overflowY: "auto",
        padding: 0,
      }}>
        {/* Hero band */}
        <div style={{
          padding: "26px 28px 18px",
          borderBottom: "0.5px solid var(--border)",
          position: "relative",
        }}>
          <button onClick={onClose} aria-label="Close" style={{
            ...modalCloseButton, position: "absolute", top: 14, right: 14,
          }}>×</button>
          <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 8 }}>{HOURGLASS}</div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: "var(--text1)",
            letterSpacing: "-0.3px", marginBottom: 4,
          }}>
            Welcome to Watchlist
          </div>
          <div style={{
            fontSize: 14, color: "var(--text2)", marginBottom: 14,
          }}>
            Vintage watches, in one feed.
          </div>
          <div style={bodyText}>
            The dealers worth following all run their own sites, in their
            own currencies, in no consistent order. Watchlist is one place
            to scan everything new — from independent dealers and the major
            auction houses — without bouncing between tabs.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 28px 22px" }}>
          <div style={sectionLabel}>What you can do</div>
          <div className="watchlist-feature-grid" style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 8,
          }}>
            <style>{`
              @media (min-width: 560px) {
                .watchlist-feature-grid {
                  grid-template-columns: 1fr 1fr !important;
                }
              }
            `}</style>
            {FEATURES.map(([verb, copy]) => (
              <div key={verb} style={featureCard}>
                <div style={featureVerb}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: "#185FA5", color: "#fff",
                    fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{verb[0]}</span>
                  {verb}
                </div>
                <div style={featureCopy}>{copy}</div>
              </div>
            ))}
          </div>

          <div style={sectionLabel}>A passion project, open to anyone</div>
          <div style={bodyText}>
            Built by a collector — a non-technical PM seeing how far you can
            get vibe-coding with AI as a co-author. Every listing links back
            to the original dealer; this is a directory layer, not a marketplace.
          </div>
          <div style={{ ...bodyText, marginTop: 8 }}>
            No ads, no tracking, no fees. Saves and likes help build a
            recommender that learns your taste — they stay yours. I don't
            sell data and I don't run ads.
          </div>

          <div style={sectionLabel}>Get in touch</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href="https://instagram.com/the_watch_list.app" target="_blank" rel="noopener noreferrer" style={linkButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              @the_watch_list.app
            </a>
            <a href={feedbackMailto} style={linkButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Suggest a dealer · Report a bug
            </a>
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "flex-end",
          padding: "14px 28px 22px",
          borderTop: "0.5px solid var(--border)",
        }}>
          <button onClick={onClose} style={{
            border: "none", background: "#185FA5", color: "#fff",
            padding: "10px 20px", borderRadius: 10,
            fontFamily: "inherit", fontSize: 14, fontWeight: 500,
            cursor: "pointer",
          }}>
            Get started →
          </button>
        </div>
      </div>
    </div>
  );
}
