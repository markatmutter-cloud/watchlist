import React, { useState, useMemo, useEffect } from "react";
import { Chip, Pill } from "../ui";
import LumeHome from "./LumeHome";
import LumeResultPanel from "./LumeResultPanel";
import LumeResultGrid from "./LumeResultGrid";
import LumeComposer from "./LumeComposer";
import { LumeConversation } from "./LumeConversation";
import { LumeIcon } from "./LumeIcon";
import { JOURNEYS } from "./LumeJourneyGrid";
import { renderLumeListingCard, renderLumeArticleCard } from "./lumeCards";
import { reasonFor } from "../lumeReasons";
import { selectMissed, deriveTasteSets, urlKey } from "../lumeMissed";
import { recordVisit, recordJourney, buildGreeting } from "../lumeColdOpen";
import { buildLead } from "../lumeHooks";
import { matchesSearch } from "../utils";

// LumeCanvas — the host-agnostic guided-session surface. Vertical rhythm on the
// canvas: a light greeting line, ONE "Start here" lead (with visible evidence),
// then curated supporting shelves (Worth your attention / Useful comps / Rabbit
// holes). The chat rail is a SESSION GUIDE (contextual prompts about the current
// view, not an onboarding intro). Search is chat-driven: a show_listings action
// from the chat renders results in the canvas (intercepted, not the tab).

const VOICE = {
  latest: "Freshest first. Here's what's just been listed.",
  missed_live: "In your taste, still live, and not yet saved.",
  got_away: "These sold before you saved them. Fastest sellers first.",
  saved_sold: "Watches you'd hearted that have since sold.",
  auctions_soon: "Auction lots closing soonest.",
  articles: "New reading from the journals.",
};
const titleFor = (key) => (JOURNEYS.find((j) => j.key === key) || {}).label || "Results";
// Which grounded reason chip a result/shelf's cards carry.
const SOURCE = { missed_live: "attention", latest: "latest", got_away: "comp", saved_sold: "comp", auctions_soon: "auction", articles: null };

export default function LumeCanvas({
  chat, user, isMobile = false, onOpenItem,
  liveItems = [], auctionLotItems = [], articles = [], watchlist = {}, savedSearches = [],
  cardCtx = {},
}) {
  const [view, setView] = useState({ kind: "home", intent: null });
  const [usage, setUsage] = useState(null);
  useEffect(() => { setUsage(recordVisit()); }, []);

  const tasteSets = useMemo(() => deriveTasteSets(watchlist), [watchlist]);

  const byId = useMemo(() => { const m = new Map(); for (const it of liveItems) if (it && it.id) m.set(it.id, it); return m; }, [liveItems]);
  const byUrl = useMemo(() => { const m = new Map(); for (const it of liveItems) if (it && it.url) m.set(urlKey(it.url), it); return m; }, [liveItems]);

  // Per-journey results (items + counts), computed once from in-memory feeds.
  const results = useMemo(() => {
    const hydrate = (res) => res.map((r) => byId.get(r.id) || byUrl.get(urlKey(r.url))).filter(Boolean);
    const now = Date.now();
    const out = {};
    const liveAll = liveItems.filter((i) => i && !i.sold && i.firstSeen)
      .sort((a, b) => (Date.parse(b.firstSeen) || 0) - (Date.parse(a.firstSeen) || 0));
    out.latest = { items: liveAll.slice(0, 24), count: liveAll.length, kind: "listing", empty: "Nothing new has landed just yet." };
    const ml = selectMissed(liveItems, { mode: "live_unsaved", ...tasteSets, limit: 15 });
    out.missed_live = { items: hydrate(ml.results), count: ml.count, kind: "listing", empty: "Heart a few watches and I'll start spotting what you missed." };
    const ga = selectMissed(liveItems, { mode: "sold_unsaved", ...tasteSets, limit: 15 });
    out.got_away = { items: hydrate(ga.results), count: ga.count, kind: "listing", empty: "Nothing notable got away this week." };
    const ss = selectMissed(liveItems, { mode: "sold_saved", ...tasteSets, limit: 15 });
    out.saved_sold = { items: hydrate(ss.results), count: ss.count, kind: "listing", empty: "None of your saved watches have sold recently." };
    const auctAll = auctionLotItems.filter((i) => i && !i.sold && i.auction_end && (Date.parse(i.auction_end) || 0) > now)
      .sort((a, b) => (Date.parse(a.auction_end) || 0) - (Date.parse(b.auction_end) || 0));
    out.auctions_soon = { items: auctAll.slice(0, 24), count: auctAll.length, kind: "listing", empty: "No lots are closing in the next while." };
    const arts = articles || [];
    out.articles = { items: arts.slice(0, 24), count: arts.length, kind: "article", empty: "No fresh articles right now." };
    return out;
  }, [liveItems, auctionLotItems, articles, tasteSets, byId, byUrl]);

  // Card renderers: a base listing/article card, and reason-chipped variants.
  const listingCard = (it) => renderLumeListingCard(it, cardCtx);
  const articleCard = (a) => renderLumeArticleCard(a, cardCtx);
  const reasonedCard = (source) => (it) => renderLumeListingCard(it, cardCtx, source ? reasonFor(it, source) : "");

  // The ONE lead (Start here), with visible evidence.
  const lead = useMemo(() => buildLead({
    liveItems, savedSearches, gotAway: results.got_away.items, missed: results.missed_live.items,
  }), [liveItems, savedSearches, results]);

  // A light personal greeting line (hello only — the substance lives in the lead).
  const greeting = useMemo(() => {
    const firstName = String(user?.user_metadata?.name || user?.user_metadata?.full_name || "").trim().split(/\s+/)[0] || "";
    return buildGreeting({ firstName, hour: new Date().getHours(), daysAway: usage?.daysAway });
  }, [user, usage]);

  // Curated supporting shelves (not feature categories). Plain const (cheap to
  // build each render) so the reason-chipped renderers don't fight memo deps.
  const shelves = (() => {
    const out = [];
    // Worth your attention: in-taste live (fall back to just-listed for cold users).
    const attn = results.missed_live.items.length ? { src: "missed_live", chip: "attention" } : { src: "latest", chip: "latest" };
    out.push({
      key: "attention", eyebrow: "WORTH YOUR ATTENTION",
      heading: results.missed_live.items.length ? "Close to what you've been saving" : "Just landed",
      dek: results.missed_live.items.length ? "Live now, in the lane you've been in." : "The freshest listings, newest first.",
      items: results[attn.src].items, count: results[attn.src].count,
      renderCard: reasonedCard(attn.chip), ctaLabel: "See all", onCta: () => openResult(attn.src),
    });
    // Useful comps: what sold, how fast, at what price.
    out.push({
      key: "comps", eyebrow: "USEFUL COMPS",
      heading: "What moved, and how fast",
      dek: "Recent sold examples to calibrate price, speed, and condition.",
      items: results.got_away.items, count: results.got_away.count,
      renderCard: reasonedCard("comp"), ctaLabel: "See comps", onCta: () => openResult("got_away"),
    });
    // Rabbit holes: reading + references connected to their interests.
    out.push({
      key: "rabbit", eyebrow: "RABBIT HOLES",
      heading: "Worth reading",
      dek: "Articles and references that connect to what you're into.",
      items: results.articles.items, count: results.articles.count,
      renderCard: articleCard, ctaLabel: "More reading", onCta: () => openResult("articles"),
    });
    return out;
  })();

  // Chat-driven search: a show_listings action from the chat renders results in
  // THIS canvas (left), instead of bouncing to the Listings tab.
  const searchGroups = useMemo(() => {
    if (view.kind !== "search") return null;
    const q = view.query || "";
    const live = liveItems.filter((i) => i && !i.sold && matchesSearch(i, q)).slice(0, 24);
    const sold = liveItems.filter((i) => i && i.sold && matchesSearch(i, q)).slice(0, 24);
    const auctions = auctionLotItems.filter((i) => i && matchesSearch(i, q)).slice(0, 24);
    return [
      { key: "listings", title: "Listings", items: live, source: null },
      { key: "sold", title: "Sold", items: sold, source: "comp" },
      { key: "auctions", title: "Auctions", items: auctions, source: "auction" },
    ].filter((g) => g.items.length);
  }, [view.kind, view.query, liveItems, auctionLotItems]);

  const panel = useMemo(() => {
    const key = view.intent;
    if (!key || !results[key]) return null;
    const r = results[key];
    return { title: titleFor(key), voice: VOICE[key] || "", items: r.items, kind: r.kind, source: SOURCE[key], isEmpty: !r.items.length, emptyText: r.empty };
  }, [view.intent, results]);

  function openResult(key) { recordJourney(key); setView({ kind: "result", intent: key }); }
  const goHome = () => setView({ kind: "home", intent: null });
  const askInRail = (text) => { if (isMobile) setView({ kind: "chat", intent: null }); chat.send(text); };
  // Lead CTAs
  const onLeadPrimary = () => {
    if (lead.source === "saved_search" && lead.searchLabel) setView({ kind: "search", intent: null, query: lead.searchLabel });
    else if (lead.source === "got_away") openResult("got_away");
    else if (lead.source === "missed_live") openResult("missed_live");
    else askInRail("What should I look at first?");
  };
  const onLeadSecondary = () => askInRail("Why do these matter, and what should I focus on?");
  // Intercept show_listings from the chat → render in the canvas.
  const onChatAction = (a) => {
    if (a && a.type === "show_listings") {
      const p = a.payload || {};
      const q = (p.query || [p.brand, p.model, p.ref].filter(Boolean).join(" ") || "").trim();
      if (q) { setView({ kind: "search", intent: null, query: q }); return true; }
    }
    return false;
  };

  // Contextual rail prompts — about the CURRENT view, not onboarding.
  const railPrompts = useMemo(() => {
    if (view.kind === "result" || view.kind === "search") {
      return ["Why were these surfaced?", "Which is the useful comp?", "Show adjacent references", "What should I ignore?"];
    }
    return ["Why these?", "Where should I start?", "What should I ignore?"];
  }, [view.kind]);

  const rootStyle = { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 };
  const scrollStyle = { flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: isMobile ? "16px 16px 8px" : "24px 22px 14px" };
  const innerStyle = { maxWidth: 880, margin: "0 auto", width: "100%" };

  // The morphing content (home / result / search), shared by both layouts.
  const content = (
    view.kind === "search" ? (
      <LumeResultPanel title={`Results for "${view.query}"`} onBack={goHome}
        isEmpty={!searchGroups || !searchGroups.length}
        emptyText={"No matches in our listings. Try fewer words, or ask Lumé to dig in."}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {(searchGroups || []).map((g) => (
            <div key={g.key}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>{g.title}</div>
              <LumeResultGrid items={g.items} renderCard={g.source ? reasonedCard(g.source) : listingCard} isMobile={isMobile} />
            </div>
          ))}
        </div>
      </LumeResultPanel>
    ) : view.kind === "result" && panel ? (
      <LumeResultPanel title={panel.title} voice={panel.voice} onBack={goHome} isEmpty={panel.isEmpty} emptyText={panel.emptyText}>
        <LumeResultGrid items={panel.items}
          renderCard={panel.kind === "article" ? articleCard : reasonedCard(panel.source)} isMobile={isMobile} />
      </LumeResultPanel>
    ) : (
      <LumeHome greeting={greeting} lead={lead} shelves={shelves}
        onLeadPrimary={onLeadPrimary} onLeadSecondary={onLeadSecondary} onOpenItem={onOpenItem} isMobile={isMobile} />
    )
  );

  // The session-guide rail: "Ask Lumé about this view" + contextual prompt chips
  // (no greeting repeat), then the conversation.
  const railHeader = (
    <div className="ui-lume-railhead">
      <div className="ui-lume-railtitle">
        <LumeIcon size={18} /> Ask Lumé about this view
      </div>
      <div className="ui-lume-chips" style={{ paddingLeft: 0 }}>
        {railPrompts.map((p) => (
          <Chip key={p} onClick={() => askInRail(p)}>{p}</Chip>
        ))}
      </div>
    </div>
  );

  // Mobile: single column; chat is a switch-in view (no side rail). Search is
  // chat-driven, so the only input is the chat composer.
  if (isMobile) {
    if (view.kind === "chat") {
      return (
        <div style={rootStyle}>
          <div style={{ flexShrink: 0, padding: "10px 14px", borderBottom: "0.5px solid var(--border)" }}>
            <Pill onClick={goHome} aria-label="Back">← Back to start</Pill>
          </div>
          <LumeConversation chat={chat} greeting="" suggestions={railPrompts} onOpenItem={onOpenItem} onAction={onChatAction} isMobile />
        </div>
      );
    }
    return (
      <div style={rootStyle}>
        <div style={scrollStyle}><div style={innerStyle}>{content}</div></div>
        <LumeComposer chat={chat} onSend={askInRail} isMobile />
      </div>
    );
  }

  // Desktop: content left, always-on session-guide rail right (the only input).
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "24px 24px 24px" }}>
        <div style={{ width: "100%" }}>{content}</div>
      </div>
      <aside style={{ width: 380, flexShrink: 0, borderLeft: "0.5px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg)" }}>
        {railHeader}
        <LumeConversation chat={chat} greeting="" suggestions={[]} onOpenItem={onOpenItem} onAction={onChatAction} isMobile={false} />
      </aside>
    </div>
  );
}
