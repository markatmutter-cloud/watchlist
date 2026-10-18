import React, { useState } from "react";
import { Modal, ModalClose, Button } from "../ui";
import { buildFeedbackMailto, captureFeedbackContext } from "../utils";

// AboutModal doubles as the welcome surface (first-visit auto-open) and
// the always-on About surface (header dropdown entry). Same content,
// two access paths.
//
// 2026-06-07 redesign #4 (Mark + external review): the modal was an
// onboarding screen, feature manual, founder story and trust statement
// in one scrolling document. It now answers only three questions —
// what is this / why trust it / what next — and the step-by-step
// "How it works" rows moved to a second VIEW inside the same modal
// (local state toggle, no new shellProps field). Other locked calls:
//   - No dealer/auction-house COUNTS anywhere in the copy. Counts rot
//     ("38 dealers… six major auction houses" shipped stale); phrase
//     so it never rots.
//   - No letter badges on the feature cards (B/S/P/L/D read as
//     keyboard shortcuts). Plain bold verbs.
//   - Lumé gets a card ("Ask"); the recommender rides inside
//     "Discover" with the part-machine/part-human/still-learning
//     transparency framing (locked recommender-trust language).
//   - Keep the "obsession (/financial situation)" line — Mark's voice.
//
// 2026-05-07 redesign #3 (still applies):
//   - Hero icon is the actual site favicon (/favicon-192.png), NOT an
//     emoji glyph. If a fallback is ever needed, ship a watch-specific
//     SVG, not a generic emoji.
//   - Modal aligns to the top of the viewport on mobile (was
//     centered) so the card sits where Mark sketched it.
//   - "Get started →" primary CTA in a footer band so newcomers have
//     an action to take, not just an X.
//   - Privacy line: present-tense first-person, not the harder
//     "never" claim.
//   - "Get in touch" leads with Instagram (Mark's preferred contact
//     channel); mailto stays as the secondary feedback link because
//     it auto-fills URL + currency + UA via `buildFeedbackMailto`.

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
  // PR_δ pattern 2026-05-22: drop the var(--surface) fill that
  // competed visually with the rest of the editorial chrome. Hairline
  // top-border separates rows; padding keeps the airy feel.
  padding: "10px 4px 10px",
  borderTop: "0.5px solid var(--border)",
  display: "flex", flexDirection: "column", gap: 4,
};

const featureVerb = {
  fontSize: 13, fontWeight: 600, color: "var(--text1)",
};

const featureCopy = {
  fontSize: 12, color: "var(--text2)", lineHeight: 1.45,
};

// Capability cards — count-free copy (counts rot; see header note).
const FEATURES = [
  ["Browse", "Live listings from independent vintage dealers and the major auction houses, in one feed. Refreshed through the day."],
  ["Save",   "Heart watches you want to revisit. Build lists by reference, theme, or project. Share them or keep them private."],
  ["Learn",  "Hand-built reference guides on the watches worth knowing, plus a daily feed of articles from across the watch world."],
  ["Discover", "Auction archives, price movement, and AI-mapped connections between references. Part machine, part human, still learning."],
  ["Plan",   "Track what you own, what you've sold, and what you'd buy next. See the cash impact of your moves before you make them."],
  ["Ask",    "Lumé, the site's resident watch expert. Ask about a reference, a listing, or what to look for. Grounded in the site's own data, and honest when it doesn't know."],
];

// "How it works" — the second view. Each row is a short verb +
// concrete steps using the CURRENT UI labels (Watches tab, Saved →
// ♡ Saved, Watchbox; verified against the live surfaces 2026-06-07).
// Mark feedback 2026-05-10: descriptions on tabs aren't enough; an
// always-on "how to" reachable from About helps people get to the
// right surface.
const HOW_TO_USE = [
  ["Heart watches", "Tap the heart on any card. Hearted watches show up under Saved → ♡ Watches (the default sub-tab)."],
  ["Save searches", "Type a query in the Watches tab, then tap the heart next to the search bar. Saved searches re-run across every dealer."],
  ["Build a list",  "Saved → Lists → + New list. Or hit ⋯ on any card → Add to… to add to an existing list."],
  ["Share a list",  "Open the list, tap Manage. Share a View Only Link, or invite by email for a Collaboration Link (they can add watches alongside you)."],
  ["Track what you own", "Open Watchbox from the account menu. + Add a watch (off-platform, with photo) or + From feed (an existing dealer listing). Tap a watch for the detail sheet: your thoughts, buy/sell numbers, journal."],
  ["Plan a move",   "Watchbox → Plan. Tap ↑ on a watch in your Collection to flag it for sale; pick from the picker below to add to your shortlist. Net cash impact updates live."],
  ["Read the guides", "Reference Guides tab → open a guide. A guide covers the reference's history, what to look for, and how examples differ."],
  ["Ask Lumé",      "Tap the speech bubble in the corner of any page. Ask about a reference, a listing, or what to look for. Answers come from the site's own data."],
];

export function AboutModal({ open, onClose, primaryCurrency }) {
  // 'about' (default) | 'how' — the How-it-works rows live behind a
  // footer link so the About view stays a short introduction, not a
  // scrolling manual. Local state on purpose: no shellProps churn.
  // Reset on close so the modal always reopens on the About view.
  const [view, setView] = useState("about");
  const close = () => { setView("about"); onClose(); };
  if (!open) return null;
  const feedbackMailto = buildFeedbackMailto({
    contextLines: captureFeedbackContext({ primaryCurrency }),
  });
  return (
    <Modal bare top width={720} onClose={close} ariaLabel="About Watchlist" className="welcome-card">
      <style>{`
        /* The features grid switches from 2-col to 1-col at narrow widths so each card stays readable. */
        @media (max-width: 559px) {
          .watchlist-feature-grid { grid-template-columns: 1fr !important; }
          .welcome-extras-pad { padding: 16px 20px 20px !important; }
        }
        .welcome-card { max-height: 80vh; }
      `}</style>
        {view === "about" ? (
          <>
          {/* Hero band — favicon + heading + tagline + intro. */}
          <div style={{
            padding: "20px 20px 16px",
            borderBottom: "0.5px solid var(--border)",
            position: "relative",
          }}>
            {/* Close button is absolute-positioned here, not flex-laid-out
                via modalTitleRow like every other modal. The hero band
                has a 2-line title + tagline + favicon icon, so the standard
                title-row layout would crush the title against the ×. The
                absolute override is a one-off legitimate exception — don't
                replicate it without the same hero-band justification. */}
            <ModalClose float onClose={close} />
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
                {/* Editorial wordmark — matches the Home hero (just
                    smaller) so the brand mark reads consistent
                    across the app. Subtitle drops a size + italicises
                    so it reads as supporting text under the brand
                    mark (Mark feedback 2026-05-11). */}
                <div style={{
                  fontSize: 18, fontWeight: 300, color: "var(--text1)",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  paddingLeft: "0.14em",
                }}>
                  Watchlist
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4, fontStyle: "italic" }}>
                  For people who watch vintage watches.
                </div>
              </div>
            </div>
            <div style={bodyText}>
              Search, save, and follow listings from across the vintage
              watch world. Dealer inventory, auction lots, sold results,
              reference guides, and saved searches, all in one place.
            </div>
            <div style={{ ...bodyText, marginTop: 10 }}>
              Built by a watch enthusiast as a passion project, not a
              marketplace. Every listing links back to the original dealer
              or auction house. No ads, no tracking, no fees, no data
              selling.
            </div>
          </div>

          <div className="welcome-extras">
            <div className="welcome-extras-pad" style={{ padding: "16px 24px 20px" }}>
              <div style={sectionLabel}>What you can do</div>
              <div className="watchlist-feature-grid" style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}>
                {FEATURES.map(([verb, copy]) => (
                  <div key={verb} style={featureCard}>
                    <div style={featureVerb}>{verb}</div>
                    <div style={featureCopy}>{copy}</div>
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
                how far I can get with AI as a co-author. My aim is to
                create things that delight watch people, and help manage
                your obsession (/financial situation). Built on the amazing
                work others have already put into the watch space; if I'm
                not crediting something properly, get in touch and I'll
                sort it. And if there's something you'd like to see, tell
                me and I'll give it a go.
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
          </>
        ) : (
          /* ── "How it works" view — same shell, swapped content. ── */
          <div style={{ padding: "16px 24px 20px", position: "relative" }}>
            <ModalClose float onClose={close} />
            <Button link onClick={() => setView("about")}>← About</Button>
            <div style={{
              fontSize: 16, fontWeight: 600, color: "var(--text1)",
              marginTop: 10, marginBottom: 12,
            }}>
              How it works
            </div>
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
          </div>
        )}

        {/* Footer band — always shown. Privacy + Terms link to the
            static pages in /public so they load fast and read clean
            outside the SPA. */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px 16px",
          borderTop: "0.5px solid var(--border)",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", gap: 14, fontSize: 12, alignItems: "center" }}>
            <Button link muted href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</Button>
            <Button link muted href="/terms.html" target="_blank" rel="noopener noreferrer">Terms</Button>
            {view === "about" && (
              <Button link muted onClick={() => setView("how")}>How it works</Button>
            )}
          </div>
          <Button primary inline onClick={close}>Get started →</Button>
        </div>
    </Modal>
  );
}
