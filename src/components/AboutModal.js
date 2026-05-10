import React from "react";
import { modalBackdrop, modalShell, modalCloseButton } from "../styles";
import { buildFeedbackMailto, captureFeedbackContext } from "../utils";

// AboutModal doubles as the welcome surface (first-visit auto-open) and
// the always-on About surface (header dropdown entry). Same content,
// two access paths.
//
// 2026-05-07 redesign #3 (Mark feedback on the #2 redesign):
//   - Hero icon is the actual site favicon (/favicon-192.png), NOT the
//     ⌛ emoji clip-art that earlier renders shipped. The favicon is
//     the brand mark — newcomers should see the same thing they see
//     in their browser tab. Don't reintroduce the emoji glyph; if a
//     fallback is ever needed, ship a watch-specific SVG, not a
//     generic emoji.
//   - Mobile: compact card. The features grid + "passion project"
//     section hide below 560px (the same breakpoint that already
//     drives the desktop 2-col vs mobile 1-col grid switch). Mobile
//     newcomers see the welcome heading + intro + Get started CTA in
//     a card that fits comfortably at the top of the viewport. The
//     full content is still reachable post-dismiss via the user
//     dropdown's "About Watchlist" entry on any device.
//   - Modal aligns to the top of the viewport on mobile (was
//     centered) so the card sits where Mark sketched it.
//   - "Get started →" primary CTA in a footer band so newcomers have
//     an action to take, not just an X.
//   - Privacy line: present-tense first-person ("I don't sell data,
//     I don't run ads"), not the harder "never" claim.
//   - "Get in touch" leads with Instagram (which Mark prefers as a
//     contact channel and can handle bug reports too); mailto stays
//     as the secondary feedback link because it auto-fills URL +
//     currency + UA into the body so the reporter doesn't have to
//     type the surface every time. See `buildFeedbackMailto` in
//     utils.js for the shared helper.

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
  ["Browse", "Live inventory from 38 independent dealers and lots from the six major auction houses, in one feed. Refreshed three times a day."],
  ["Save",   "Heart anything you want to come back to. Build lists by theme or reference, share them with someone, or keep them private."],
  ["Plan",   "Track what you own, what you've sold, and what you'd buy next. See the cash impact of your moves before you make them."],
  ["Learn",  "Wrist-fit comparison printouts, dealer link directory, and reference research clusters. Encyclopedia coming."],
  ["Discover", "Auction-house archive feeds + cross-source price velocity show you watches you'd never have stumbled on yourself."],
];

// "How to use" — a tighter walkthrough for newcomers who want to know
// where each feature lives. Each row is a short verb + concrete steps.
// Mark feedback 2026-05-10: descriptions on tabs aren't enough; an
// always-on "how to" in About helps people get to the right surface.
const HOW_TO_USE = [
  ["Heart watches", "Tap the heart on any card. Hearted watches show up under Saved → Saved (the default sub-tab)."],
  ["Save searches", "Type a query in the Listings tab, then tap the heart next to the search bar. Saved searches re-run across every dealer."],
  ["Build a list",  "Saved → Lists → + New list. Or hit ⋯ on any card → Add to… to add to an existing list."],
  ["Share a list",  "Open the list, tap Manage. Share a View Only Link, or invite by email for a Collaboration Link (they can add watches alongside you)."],
  ["Track what you own", "Saved → My Watches → + Add a watch (off-platform, with photo) or + From feed (an existing dealer listing). Tap a watch for the detail sheet — your thoughts, buy/sell numbers, journal."],
  ["Plan a move",   "My Watches → Plan. Tap ↑ on a Keeping watch to flag it for sale; pick from the picker below to add to your shortlist. Net cash impact updates live."],
];

export function AboutModal({ open, onClose, primaryCurrency }) {
  if (!open) return null;
  const feedbackMailto = buildFeedbackMailto({
    contextLines: captureFeedbackContext({ primaryCurrency }),
  });
  return (
    <div onClick={onClose} className="welcome-backdrop" style={modalBackdrop}>
      <style>{`
        /* Top-align the welcome card on mobile so it sits at the
           top of the viewport (Mark feedback). The !important is
           needed to override modalBackdrop's inline alignItems. */
        .welcome-backdrop {
          align-items: flex-start !important;
          padding: 24px 20px 20px !important;
        }
        @media (min-width: 560px) {
          .welcome-backdrop {
            align-items: center !important;
            padding: 20px !important;
          }
        }
        /* Mobile-only: hide the features grid + passion-project
           section so the welcome card stays compact. The full
           content is still reachable via the user dropdown's
           About Watchlist entry on any device. */
        @media (max-width: 559px) {
          .welcome-extras { display: none !important; }
        }
      `}</style>
      <div onClick={e => e.stopPropagation()} style={{
        ...modalShell,
        maxWidth: 720,
        maxHeight: "88vh",
        overflowY: "auto",
        padding: 0,
      }}>
          {/* Hero band — favicon + heading + tagline + intro. Always
              shown on every viewport. */}
          <div style={{
            padding: "20px 22px 16px",
            borderBottom: "0.5px solid var(--border)",
            position: "relative",
          }}>
            {/* Close button is absolute-positioned here, not flex-laid-out
                via modalTitleRow like every other modal. The hero band
                has a 2-line title + tagline + favicon icon, so the standard
                title-row layout would crush the title against the ×. The
                absolute override is a one-off legitimate exception — don't
                replicate it without the same hero-band justification. */}
            <button onClick={onClose} aria-label="Close" style={{
              ...modalCloseButton, position: "absolute", top: 12, right: 12,
            }}>×</button>
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 10,
            }}>
              <img
                src="/favicon-192.png"
                alt=""
                width={44} height={44}
                style={{
                  width: 44, height: 44, borderRadius: 8,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: "var(--text1)",
                  letterSpacing: "-0.3px",
                }}>
                  Welcome to Watchlist
                </div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>
                  Vintage watches, in one feed.
                </div>
              </div>
            </div>
            <div style={bodyText}>
              Watchlist aggregates new listings from across independent
              dealers and auction houses to make your watch 'problem'
              more manageable.
            </div>
            <div style={{ ...bodyText, marginTop: 10 }}>
              Built by a watch enthusiast as a passion project. Every listing
              links back to the original dealer; this is a directory layer,
              not a marketplace. No ads, no tracking, no fees, no data selling.
            </div>
          </div>

          {/* "Extras" — features grid + passion-project section. Hidden
              on mobile (<560px) so the welcome card stays compact at
              the top of the viewport. The full content is reachable
              post-dismiss via the user dropdown's About Watchlist
              entry on any device. */}
          <div className="welcome-extras">
            <div style={{ padding: "16px 28px 22px" }}>
              <div style={sectionLabel}>What you can do</div>
              <div className="watchlist-feature-grid" style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}>
                {FEATURES.map(([verb, copy]) => (
                  <div key={verb} style={featureCard}>
                    <div style={featureVerb}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: "var(--brand)", color: "#fff",
                        fontSize: 11, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>{verb[0]}</span>
                      {verb}
                    </div>
                    <div style={featureCopy}>{copy}</div>
                  </div>
                ))}
              </div>

              <div style={sectionLabel}>How to use it</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {HOW_TO_USE.map(([verb, copy]) => (
                  <div key={verb} style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "0.5px solid var(--border)",
                    background: "var(--card-bg)",
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text1)",
                      marginBottom: 2,
                    }}>{verb}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{copy}</div>
                  </div>
                ))}
              </div>

              <div style={sectionLabel}>Why I built this</div>
              <div style={bodyText}>
                I used to spend more time in the day than I could afford
                going between different websites trying to keep track of
                new listings and researching new references. I wanted a tool
                that could help me do this with less effort.
              </div>
              <div style={{ ...bodyText, marginTop: 8 }}>
                I'm a non-technical product manager in my day job, seeing
                how far I can get with AI as a co-author. My aim is to create
                things that delight watch people, like making "3 watches for
                $50,000" challenges fun, or helping manage your obsession
                (/financial situation).
              </div>
              <div style={{ ...bodyText, marginTop: 8 }}>
                Built on the amazing work others have already put into the
                watch space. If I'm not calling out credit appropriately,
                please get in touch and I'll sort that out.
              </div>
              <div style={{ ...bodyText, marginTop: 8 }}>
                A public roadmap is coming. Let me know if there's something
                you'd like to see and I'll give it a go.
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
          </div>

          {/* Footer CTA — always shown. */}
          <div style={{
            display: "flex", gap: 10, justifyContent: "flex-end",
            padding: "12px 22px 16px",
            borderTop: "0.5px solid var(--border)",
          }}>
            <button onClick={onClose} style={{
              border: "none", background: "var(--brand)", color: "#fff",
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
