import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../supabase";
import { dispatchAction, resolveItemByUrl } from "./ActionBus";
import { registerLumeOpener } from "./LumeBus";
import { LumeIcon } from "./LumeIcon";
import { useLumeChat, LumeConversation, describeItem, NAME, GREETING, SUGGESTIONS } from "./LumeConversation";
import LumeCanvas from "./LumeCanvas";
import { Button } from "../ui";

// renderInline now lives with the conversation core; re-export it so the
// existing ChatBubbleHost.test.jsx import keeps working.
export { renderInline } from "./LumeConversation";

// Lumé — the watch-expert concierge bubble (Epic 9 "AI spine").
//
// Mounts ONCE at the top of the app next to <ConfirmHost/> (App.js), as a
// sibling of the shells — its surface state lives here, App.js gains no new
// hooks (no React #310 risk) and no shellProps. The conversation itself (state +
// message/composer render) is the shared LumeConversation. On desktop the ⤢
// expanded bubble mounts the full LumeCanvas (the guided-session design that used
// to be the standalone Lumé tab, re-homed here 2026-06-18); the corner frame and
// mobile sheet stay the bare conversation. Theme inherits via :root CSS vars (portal → body).
//
// Signed-OUT users see the launcher too (B-43) — tapping it prompts sign-in.
// Signed-in: the grounded chat. The cold-open VOICE + grounding live server-side
// in SYSTEM_PROMPT (api/chat.js); this stays a thin shell.
//
// NB: solid-olive surfaces use #fff text, NOT --brand-olive-ink (that ink is the
// DARK sage for light olive *tints* — invisible on solid olive). (B-39)

// Layering lives in ui.css (--ui-lume-z: 1400, below the confirm / review modals).
const OPENED_KEY = "lume_opened_v1";

export function ChatBubbleHost({
  seedItem = null,
  // Feed data for the desktop EXPANDED canvas (the old Lumé-tab design, re-homed
  // here 2026-06-18). Only the ⤢-expanded desktop bubble mounts LumeCanvas; the
  // corner frame and mobile sheet stay the bare conversation, so these are unused
  // until the user expands.
  liveItems = [], auctionLotItems = [], articles = [], watchlist = {},
  savedSearches = [], cardCtx = {},
}) {
  // seedItem (Mark 2026-06-01): on the share-receive surfaces the floating
  // launcher STAYS, but it pops out an "Ask Lumé" callout and opens SEEDED with
  // the shared item (so the chat is about what's on screen, not blank). Off the
  // share surfaces seedItem is null and the launcher opens a normal chat.
  const { user, signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(max-width: 600px)").matches
  );
  // Desktop expand-to-fullscreen (Mark): the bubble is a 380px frame; ⤢ blows it
  // up to a near-full-screen takeover for a real conversation. Mobile is already
  // full-screen, so expand is desktop-only and resets on minimise.
  const [expanded, setExpanded] = useState(false);
  // A SEEDED open (share-with-Lumé from a card's ⋯ menu, or the share-receive
  // surface's "Ask Lumé") starts the thread with a real question about a real
  // watch — the standard "So, what's your watch problem?" intro on top of it
  // reads as boilerplate and buries the answer (Mark). Seeded → no greeting;
  // sticks for the life of the thread so minimise/reopen doesn't bring it back.
  const [seeded, setSeeded] = useState(false);
  const [hasOpened, setHasOpened] = useState(() => {
    try { return typeof localStorage !== "undefined" && localStorage.getItem(OPENED_KEY) === "1"; }
    catch { return false; }
  });
  // The conversation state + send loop (shared with the inline tab). This is the
  // bubble's own instance — ephemeral; minimising drops nothing but the panel.
  const chat = useLumeChat();
  const { messages, send, loading } = chat;

  const openChat = useCallback(() => {
    setOpen(true);
    setHasOpened(true);
    try { localStorage.setItem(OPENED_KEY, "1"); } catch {}
  }, []);

  // Open a watch link from the reply body in-app (the shared surface). Only
  // called for links LumeConversation already confirmed resolve to a live watch.
  const openItemInApp = useCallback((url) => {
    // Resolve to the real item and open by its id — open_watch keys on the feed's
    // SHA1 id, so passing itemUrl (which it would re-hash with shortHash) wouldn't
    // resolve. resolveItemByUrl already confirmed this one resolves.
    const item = resolveItemByUrl(url);
    const payload = item ? { itemId: item.id, itemUrl: item.url } : { itemUrl: url };
    dispatchAction({ type: "open_watch", payload }).then((res) => {
      // Keep Lumé OPEN on desktop (Mark): the surface opens behind the floating
      // panel, and the most likely next click is the NEXT link in Lumé's list —
      // don't make them re-open the chat. On mobile the panel is a full-screen
      // sheet that would cover the watch, so minimise there to reveal it.
      if (res && res.ok && isMobile) setOpen(false);
    });
  }, [isMobile]);

  // Track narrow viewports → Lumé goes full-screen on mobile.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 600px)");
    const on = () => setIsMobile(mq.matches);
    on();
    if (mq.addEventListener) mq.addEventListener("change", on);
    else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else mq.removeListener(on); };
  }, []);

  // While the full-screen sheet is open on mobile, lock the page behind it so
  // scrolling stays inside the chat (no underlying-screen scroll bleed — Mark).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!(open && isMobile)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  // "Share with Lumé" (B-52): a card's ⋯ row calls askLumeAbout(item) → this
  // opens the bubble and, if signed in, kicks off a conversation about that
  // listing. Re-registers when send/openChat change so it always uses the live
  // handlers. Signed-out → just opens (the sign-in panel shows).
  useEffect(() => {
    return registerLumeOpener((item) => {
      openChat();
      if (item) setSeeded(true);
      if (user && item) send(describeItem(item));
    });
  }, [user, send, openChat]);

  if (typeof document === "undefined") return null;

  // Desktop: a floating rounded frame, bottom-right. Mobile: full-screen sheet
  // (you can't see the page behind it anyway), with safe-area-aware chrome.
  // Desktop EXPANDED: a centered near-full-screen takeover over a dimmed backdrop.
  // All of it is `.ui-lume-*` in src/ui/ui.css (2026-10-17 refresh): one definition.
  const isExpanded = expanded && !isMobile;
  const frameClass = isMobile ? "ui-lume-panel--sheet"
    : isExpanded ? "ui-lume-panel--expanded"
    : "ui-lume-panel--corner";
  const header = (
    <div className="ui-lume-head">
      <span className="ui-lume-mark"><LumeIcon size={26} style={{ display: "block" }} /></span>
      <div className="ui-lume-who">
        <span className="ui-lume-name">{NAME}</span>
        {/* The disclosure (UX principles 2 + 13): clearly the AI, and still learning. */}
        <span className="ui-lume-sub">Watch chat · AI, still learning</span>
      </div>
      {/* Desktop + signed-in only: ⤢ expand to a full-screen takeover / ⤡
          collapse back to the corner frame. Mobile is already full-screen. */}
      {!isMobile && user && (
        <button type="button" className="ui-lume-hbtn" onClick={() => setExpanded((e) => !e)}
          aria-label={isExpanded ? "Collapse" : "Expand"} title={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 14h6v6" /><path d="M20 10h-6V4" /><path d="M14 10l7-7" /><path d="M3 21l7-7" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>}
        </button>
      )}
      {/* Mobile: a down-chevron reads as "minimise" (drop it back to the launcher);
          desktop: the usual ×. Both minimise + reset expand. */}
      <button type="button" className="ui-lume-hbtn" onClick={() => { setOpen(false); setExpanded(false); }}
        aria-label="Minimise" title="Minimise">
        {isMobile
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          : "×"}
      </button>
    </div>
  );

  let node;

  if (!open) {
    // Tapping the launcher (or the callout) opens SEEDED when there's a shared
    // item on screen, else a normal chat. Seed ONLY an empty conversation (P-29):
    // Lumé minimises after every action button, so without the guard every reopen
    // re-sent the same seed question — one full model turn per round-trip.
    const openSeeded = () => {
      openChat();
      if (seedItem) setSeeded(true);
      if (seedItem && user && messages.length === 0 && !loading) send(describeItem(seedItem));
    };
    const showCallout = !!seedItem || !hasOpened;
    node = (
      <div className="ui-lume-launch">
        {showCallout && (
          <button type="button" className="ui-lume-ask" onClick={openSeeded}>
            {seedItem ? "Ask Lumé" : "Ask me"}
          </button>
        )}
        <button type="button" className="ui-lume-dot" onClick={openSeeded} aria-label={`Open ${NAME}`}>
          <LumeIcon size={44} style={{ display: "block" }} />
        </button>
      </div>
    );
  } else if (!user) {
    // Signed-out: prompt to sign in. (B-43)
    node = (
      <div className={`ui-lume-panel ${frameClass}`} role="dialog" aria-label={NAME}>
        {header}
        <div className="ui-lume-invite">
          <div>
            Sign in to chat with <strong>Lumé</strong>, your watch guide. It digs through live
            listings and auctions, pulls up reference guides, and saves things to your lists.
          </div>
          <Button primary onClick={() => { try { signInWithGoogle && signInWithGoogle(); } catch {} }}>
            Sign in to chat
          </Button>
        </div>
      </div>
    );
  } else {
    // Signed-in. The corner frame + mobile sheet stay the bare conversation.
    // Desktop EXPANDED mounts the full guided-session canvas (the re-homed
    // Lumé-tab design: greeting + lead + shelves + morphing results, with the
    // conversation as the right rail). Same `chat` instance flows through both,
    // so expanding/collapsing keeps the thread. The canvas owns its own scroll,
    // so it slots into a flex:1 body below the shared header.
    node = (
      <div className={`ui-lume-panel ${frameClass}${isMobile || isExpanded ? "" : " ui-lume-panel--tall"}`}
           role="dialog" aria-label={NAME}>
        {header}
        {isExpanded ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <LumeCanvas
              chat={chat}
              user={user}
              isMobile={false}
              onOpenItem={openItemInApp}
              liveItems={liveItems}
              auctionLotItems={auctionLotItems}
              articles={articles}
              watchlist={watchlist}
              savedSearches={savedSearches}
              cardCtx={cardCtx}
            />
          </div>
        ) : (
          <LumeConversation
            chat={chat}
            onOpenItem={openItemInApp}
            onActionResult={(a, res) => { if (res && res.ok) setOpen(false); }}
            isMobile={isMobile}
            greeting={seeded ? "" : GREETING}
            suggestions={seeded ? [] : SUGGESTIONS}
          />
        )}
      </div>
    );
  }

  return createPortal(
    <>
      {/* Dimmed backdrop behind the expanded desktop takeover; click to collapse. */}
      {open && isExpanded && (
        <div className="ui-lume-scrim" onClick={() => setExpanded(false)} aria-hidden />
      )}
      {node}
    </>,
    document.body
  );
}
