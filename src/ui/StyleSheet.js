// StyleSheet — the live reference page for the shared page frame (`?view=styleguide`).
//
// Mark, 2026-10-17: "every page is different ... how can I fix this without
// chasing leaks". The fix is one definition per piece (src/ui), approved ONCE here
// — pieces, composed pages at desktop AND phone width, and the open decisions
// shown side by side — before any tab is moved over. Nothing on this page is
// fake chrome: every piece is the real component the tabs will use.
//
// The phone frames are real 390px containers (the frame styles respond to their
// container, not the window), so the phone layout is visible on a desktop screen.

import React, { useState } from "react";
import {
  Pill, SavedPill, SearchField, SubTabs, FilterBar, PageFrame, Count,
  AccountDisc, SuggestionRows, Chip, ChipPanel, PriceRange, Button, DismissChip, JumpNav, SectionHead,
  Modal, ModalNote, ModalFoot, ModalLabel, FieldLabel, Input, PickRow,
  OverlayButton, OverlayHeart, OverlayMenu, MenuItem, AccountMenu, AccountMenuHead, AccountMenuSection, AddTile,
} from "./index";
import { FilterDrawer } from "../components/FilterDrawer";
import { MagazineShellBar, MagazineBrandRow, MagazineTabRow } from "../components/MagazineShellBar";
import { FilterIcon } from "../components/icons";
import { LumeIcon } from "../components/LumeIcon";
import { LumeConversation, GREETING, SUGGESTIONS } from "../components/LumeConversation";
import "./StyleSheet.css";

const noop = () => {};

// The Watches sub-tabs as approved: the Saved tab is the heart alone (D5).
const WATCH_TABS = [
  { key: "live", label: "For sale" }, { key: "auctions", label: "Auctions" },
  { key: "sold", label: "Sold" }, { key: "saved", label: "♡", ariaLabel: "Saved" },
];

// ---- little helpers -----------------------------------------------------------------

function demoTabs(active) {
  return [
    { key: "listings", label: "Watches", mobileLabel: "Watches" },
    { key: "articles", label: "Articles", mobileLabel: "Articles" },
    { key: "guides", label: "Reference Guides", mobileLabel: "Guides" },
  ].map((t) => ({ ...t, active: t.key === active, onSelect: noop }));
}

// A pill that actually toggles, so the page feels like the real thing.
function TogglePill({ start = false, ...props }) {
  const [on, setOn] = useState(start);
  return <Pill {...props} on={on} toggle onClick={() => setOn((v) => !v)} />;
}

function Section({ id, title, note, children }) {
  return (
    <section className="ss-sec" id={id}>
      <h2 className="ss-h2">{title}</h2>
      {note ? <p className="ss-note">{note}</p> : null}
      {children}
    </section>
  );
}

function Specimen({ label, children, wide }) {
  return (
    <div className={`ss-spec${wide ? " ss-spec--wide" : ""}`}>
      <div className="ss-spec-label">{label}</div>
      <div className="ss-spec-body">{children}</div>
    </div>
  );
}

function Swatch({ name, token, border }) {
  return (
    <div className="ss-swatch">
      <span className="ss-swatch-chip" style={{ background: `var(${token})`, borderColor: border ? "var(--border)" : "transparent" }} />
      <span className="ss-swatch-name">{name}</span>
      <code className="ss-swatch-token">{token}</code>
    </div>
  );
}

// Placeholder cards: the page frame is about the chrome, not the content.
function Cards({ n = 6 }) {
  return (
    <div className="ss-cards">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="ss-card">
          <div className="ss-card-img" />
          <div className="ss-card-kicker">DEALER NAME</div>
          <div className="ss-card-title">A watch or an article title that runs to two lines</div>
        </div>
      ))}
    </div>
  );
}

// ---- the composed pages -----------------------------------------------------------------
// Both are built ONLY from src/ui + the shared header, exactly as a real tab will be.

function SavedSuggestions() {
  return (
    <div className="ui-search-drop">
      <SuggestionRows heading="Saved searches" onRun={noop} onRemove={noop}
        rows={[
          { id: "1", label: "Speedmaster pro", meta: "12 for sale · 2 new" },
          { id: "2", label: "Datejust 1601 silver dial", meta: "4 for sale" },
        ]} />
    </div>
  );
}

// The header is the same on every page, search included: wordmark · tabs · search · heart · account
// on a desktop, brand row · tabs · search row on a phone (Mark, 2026-10-17).
function DemoHeader({ phone, active, search }) {
  return phone
    ? <><MagazineBrandRow authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />
        <div className="ss-phone-stick"><MagazineTabRow tabs={demoTabs(active)} />
          <div className="ss-phone-search">{search}</div></div></>
    : <MagazineShellBar tabs={demoTabs(active)} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop}
                        onHome={noop} searchJSX={search} />;
}

function ArticlesPage({ phone }) {
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(false);
  const search = (
    <SearchField size={phone ? "full" : "bar"} value={q} onChange={(e) => setQ(e.target.value)}
                 onClear={() => setQ("")} placeholder="Search articles…" ariaLabel="Search articles" />
  );
  return (
    <>
      <DemoHeader phone={phone} active="articles" search={search} />
      <PageFrame
        filterBar={
          <FilterBar
            pills={<><TogglePill>Source</TogglePill><TogglePill>Brand</TogglePill>
                    <SavedPill on={saved} onClick={() => setSaved((v) => !v)} what="saved articles" /></>}
            count="11,288 articles" />
        }>
        <Cards n={phone ? 3 : 8} />
      </PageFrame>
    </>
  );
}

function WatchesPage({ phone }) {
  const [sub, setSub] = useState("live");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const search = (
    <SearchField size={phone ? "full" : "bar"} value={q} onChange={(e) => setQ(e.target.value)}
                 onClear={() => setQ("")} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
                 placeholder="Brand, model, reference" ariaLabel="Search watches">
      {open && !q ? <SavedSuggestions /> : null}
    </SearchField>
  );
  return (
    <>
      <DemoHeader phone={phone} active="listings" search={search} />
      <PageFrame
        subTabs={<SubTabs ariaLabel="Watches views" activeKey={sub} onSelect={setSub} tabs={WATCH_TABS} />}
        subTabsEnd={<Count>4,503 watches</Count>}
        filterBar={
          <FilterBar
            pills={phone
              ? <><Pill icon={<FilterIcon />} n={2} on>Filter</Pill><TogglePill start>Date ↓</TogglePill><TogglePill>Price</TogglePill></>
              : <><TogglePill>Source</TogglePill><TogglePill>Brand</TogglePill><TogglePill>Model</TogglePill></>}
            end={phone ? null : <><TogglePill start>Date ↓</TogglePill><TogglePill>Price</TogglePill></>}
          />
        }>
        <Cards n={phone ? 4 : 10} />
      </PageFrame>
    </>
  );
}

// ---- Lumé: the launcher and the chat, with a canned exchange ---------------------------------------
// The real LumeConversation and LumeInput, fed a fake `chat`, so what is reviewed here is what ships.

const SAMPLE = [
  { role: "user", content: "Is there a clean 5513 under $12k?" },
  {
    role: "assistant",
    content: "Three **Submariner 5513** are live under $12,000. The cleanest is the [1968 gilt-dial example](https://example.com/5513) from Analog Shift at $11,400, with matching tritium and a service history.\n\nWant the other two, or a quick note on what to check on a 5513?",
    actions: [{ label: "Show all three" }, { label: "Open the 1968" }],
  },
];

function useSampleChat({ messages = SAMPLE, loading = false, capped = false, error = "" } = {}) {
  const [draft, setDraft] = useState("");
  return {
    messages, draft, setDraft, loading, capped, error, actionState: { "1-0": { status: "done" } },
    listening: false, send: noop, runAction: async () => ({ ok: true }), toggleMic: noop,
    scrollRef: { current: null }, inputRef: { current: null },
  };
}

function LumeHead({ sheet }) {
  return (
    <div className="ui-lume-head">
      <span className="ui-lume-mark"><LumeIcon size={26} style={{ display: "block" }} /></span>
      <div className="ui-lume-who">
        <span className="ui-lume-name">Lumé</span>
        <span className="ui-lume-sub">Watch chat · AI, still learning</span>
      </div>
      {!sheet ? <button type="button" className="ui-lume-hbtn" aria-label="Expand" title="Expand">⤢</button> : null}
      <button type="button" className="ui-lume-hbtn" aria-label="Minimise" title="Minimise">{sheet ? "⌄" : "×"}</button>
    </div>
  );
}

function LumePanel({ fresh, sheet, ...state }) {
  const chat = useSampleChat(fresh ? { messages: [] } : state);
  return (
    <div className="ui-lume-panel" style={{ width: sheet ? 390 : 380, height: sheet ? 640 : 560, maxWidth: "100%",
                                            borderRadius: sheet ? 30 : undefined }}>
      <LumeHead sheet={sheet} />
      <LumeConversation chat={chat} isMobile={!!sheet}
        greeting={fresh ? GREETING : ""} suggestions={fresh ? SUGGESTIONS : []} onOpenItem={noop} />
    </div>
  );
}

function LumeSection() {
  return (
    <Section id="lume" title="6 · Lumé: the dot and the chat"
             note="Refreshed 2026-10-17 on the same language as the pages: paper surface, one hairline, the header's Bodoni name and mono caption, solid olive for what you did, outlined olive for what Lumé offers. The mark stays abstract (a lume pip, never a face).">
      <Specimen label="The launcher: first visit (with the label) · after you have used it · over a light page · over a dark one">
        <div className="ss-row" style={{ gap: 28, alignItems: "center" }}>
          <div className="ss-lume-stage">
            <button type="button" className="ui-lume-ask">Ask me</button>
            <button type="button" className="ui-lume-dot" aria-label="Open Lumé"><LumeIcon size={44} style={{ display: "block" }} /></button>
          </div>
          <div className="ss-lume-stage">
            <button type="button" className="ui-lume-dot" aria-label="Open Lumé"><LumeIcon size={44} style={{ display: "block" }} /></button>
          </div>
          <div className="ss-lume-stage ss-lume-stage--dark">
            <button type="button" className="ui-lume-ask">Ask Lumé</button>
            <button type="button" className="ui-lume-dot" aria-label="Open Lumé"><LumeIcon size={44} style={{ display: "block" }} /></button>
          </div>
        </div>
        <p className="ss-small">The real one is bottom right of this page. The pip breathes slowly (and stops if the device asks for reduced motion). The label shows until the first open, and on a shared watch ("Ask Lumé").</p>
      </Specimen>
      <Specimen label="The panel: opening · a reply with offers · thinking · today's cap">
        <div className="ss-lume-row">
          <LumePanel fresh />
          <LumePanel />
          <LumePanel messages={[SAMPLE[0]]} loading />
          <LumePanel messages={SAMPLE} capped />
        </div>
        <p className="ss-small">Lumé's words sit on the paper with a pip in the gutter; yours are a solid olive bubble. Offers are outlined and fill olive on hover; a visited one keeps its tick and stays clickable. Suggestions are the same chips as the filter panels.</p>
      </Specimen>
      <Specimen label="On a phone (the sheet) · signed out">
        <div className="ss-lume-row">
          <LumePanel sheet />
          <div className="ui-lume-panel" style={{ width: 380, maxWidth: "100%" }}>
            <LumeHead />
            <div className="ui-lume-invite">
              <div>Sign in to chat with <strong>Lumé</strong>, your watch guide. It digs through live listings and auctions, pulls up reference guides, and saves things to your lists.</div>
              <Button primary>Sign in to chat</Button>
            </div>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

// ---- the page ------------------------------------------------------------------------------------

// The phone's filter sheet, opened for real from a button: it is `position: fixed`, so it can only
// be shown live, not laid out in the page.
function SheetDemo() {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState(["Rolex"]);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const toggle = (b) => setBrands((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the filter sheet</Button>
      <FilterDrawer
        drawerOpen={open} setDrawerOpen={setOpen}
        showDealerSources showAuctionSources
        DEALER_SOURCES={["Analog Shift"]} AUCTION_SOURCES={["Phillips"]}
        visibleSources={["Analog Shift", "Phillips"]} filterSources={[]} toggleSource={noop}
        effectiveSourcesCount={2} SOURCES_SHOW={8} sourcesExpanded={false} setSourcesExpanded={noop}
        visibleBrands={["Rolex", "Omega", "Patek Philippe"]} filterBrands={brands} toggleBrand={toggle}
        effectiveBrandsCount={3} BRANDS_SHOW={8} brandsExpanded={false} setBrandsExpanded={noop}
        MODELS={["Submariner"]} visibleModels={["Submariner"]} filterModels={[]} toggleModel={noop}
        effectiveModelsCount={1} MODELS_SHOW={8} modelsExpanded={false} setModelsExpanded={noop}
        minPriceText={min} setMinPriceText={setMin} maxPriceText={max} setMaxPriceText={setMax}
        hasFilters={brands.length > 0 || !!min || !!max}
        resetFilters={() => { setBrands([]); setMin(""); setMax(""); }}
        displayedCount={1234} />
    </>
  );
}

function PriceDemo() {
  const [min, setMin] = useState("");
  const [max, setMax] = useState("5000");
  return <PriceRange min={min} max={max} onMin={setMin} onMax={setMax}
                     onClear={() => { setMin(""); setMax(""); }} />;
}

export default function StyleSheet({ tabs, authJSX, onHome, isMobile }) {
  const [saved, setSaved] = useState(false);
  const [q, setQ] = useState("Submariner");
  const [tab, setTab] = useState("live");
  return (
    <div className="ss">
      {isMobile
        ? <><MagazineBrandRow authJSX={authJSX} showSaved={false} onHome={onHome} />
            <MagazineTabRow tabs={tabs} /></>
        : <MagazineShellBar tabs={tabs} authJSX={authJSX} onHome={onHome} />}

      <div className="ss-wrap">
        <header className="ss-head">
          <p className="ss-eyebrow">Style sheet · the shared page frame</p>
          <h1 className="ss-h1">One definition per piece</h1>
          <p className="ss-lede">
            Every tab below the header is built from the pieces on this page and nothing else. This is the approved
            version: Mark's five picks (2026-10-17) are in, and section 5 records them. Everything shown is the real
            component, and the phone frames are real 390px containers, so the phone layout can be judged from a
            desktop window (or open this page on a phone).
          </p>
          <p className="ss-lede">
            Tabs are moving onto these one at a time, and each old piece is deleted as its last user goes. If a page
            looks different from this one, the page is wrong, not the style sheet.
          </p>
        </header>

        <Section id="anatomy" title="1 · The page anatomy"
                 note="Every page is these four bands, in this order, at one left edge (20px; 16px on a phone). Any band can be absent; none can move.">
          <ol className="ss-anatomy">
            <li><b>Header bar</b>: wordmark · tabs · search · heart · account. 56px, every tab, and the search is the same box in the same place on every page that has one (a phone: a 40px search row under the tabs). Home keeps its masthead on a desktop.</li>
            <li><b>Sub-tabs</b>: optional; "where you are", always the segmented control. The count can sit at their right.</li>
            <li><b>Filter bar</b>: pills left · the page's controls and count right. It carries no search of its own (the search is the header's); a phone drops the count under the pills.</li>
            <li><b>Content</b>: cards, lists, whatever the page is for. There is no page title; the header's active tab says where you are.</li>
          </ol>
        </Section>

        <Section id="tokens" title="2 · Colour, type and size"
                 note="All of this already exists in the app's tokens; the shared pieces read only these.">
          <div className="ss-swatches">
            <Swatch name="Page" token="--bg" border />
            <Swatch name="Raised / field" token="--card-bg" border />
            <Swatch name="Tray / track" token="--surface" border />
            <Swatch name="Text" token="--text1" />
            <Swatch name="Text 2" token="--text2" />
            <Swatch name="Text 3" token="--text3" />
            <Swatch name="Olive (solid)" token="--brand-olive" />
            <Swatch name="Olive ink" token="--brand-olive-ink" />
            <Swatch name="Olive tint" token="--brand-olive-tint-12" border />
            <Swatch name="Hairline" token="--border" border />
            <Swatch name="Heart (save buttons on cards only)" token="--heart" />
          </div>
          <div className="ss-type">
            <div><span className="ss-type-d">Watchlist</span><code>Bodoni 30px: the wordmark (header only)</code></div>
            <div><span className="ss-type-m">WATCHES · ARTICLES · REFERENCE GUIDES</span><code>mono 12.5px, tracked: header tabs</code></div>
            <div><span className="ss-type-t">For sale</span><code>13px · 500 / 600: sub-tab</code></div>
            <div><span className="ss-type-l">SOURCE · 11,288 ARTICLES</span><code>11px, tracked caps: pills, counts, eyebrows</code></div>
            <div><span className="ss-type-b">Search articles, brand, model, reference</span><code>14px: fields and body (system sans)</code></div>
          </div>
          <table className="ss-table">
            <tbody>
              <tr><td>Page edge</td><td>20px · 16px phone</td></tr>
              <tr><td>Header bar</td><td>56px</td></tr>
              <tr><td>Pills</td><td>36px · 40px phone</td></tr>
              <tr><td>Sub-tab track</td><td>36px · 40px phone (same as a pill)</td></tr>
              <tr><td>Search field</td><td>37 to 38px · 40px phone</td></tr>
              <tr><td>Account disc</td><td>36px · 40px phone</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="pieces" title="3 · The pieces"
                 note="Each is one component in src/ui. Change it there and it changes everywhere.">
          <Specimen label="Header bar: with a search seated in it, and without (a page with nothing to search)">
            <div className="ss-bar-demo">
              <MagazineShellBar tabs={demoTabs("listings")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop}
                searchJSX={<SearchField size="bar" value="" onChange={noop} placeholder="Brand, model, reference" />} />
              <MagazineShellBar tabs={demoTabs("articles")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />
            </div>
          </Specimen>
          <Specimen label="Header bar: phone (brand row scrolls away; tabs and the search row stay)">
            <div className="ss-phone-box">
              <MagazineBrandRow authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />
              <MagazineTabRow tabs={demoTabs("articles")} />
              <div className="ss-phone-search">
                <SearchField size="full" value="" onChange={noop} placeholder="Brand, model, reference" />
              </div>
            </div>
          </Specimen>
          <Specimen label="Pill: default · selected · with a count · with an icon · icon-only (Saved) · quiet">
            <div className="ss-row">
              <Pill>Source</Pill>
              <Pill on>Brand</Pill>
              <Pill on n={2}>Source</Pill>
              <Pill icon={<FilterIcon />}>Filter</Pill>
              <SavedPill on={saved} onClick={() => setSaved((v) => !v)} />
              <SavedPill on onClick={noop} />
              <Pill quiet>+36 more</Pill>
            </div>
            <p className="ss-small">Click them. Selected is solid olive, the same "on" as the sub-tab's active chip. The heart is a bare icon: no word, never red.</p>
          </Specimen>
          <Specimen label="Chip: the options behind a pill (sources, brands, models), shown in the open panel">
            <ChipPanel>
              <Chip n={1648}>Hairspring Finds</Chip>
              <Chip on n={256}>Bring a Loupe</Chip>
              <Chip n={3756}>Rolex Magazine</Chip>
              <Chip n={206}>On The Dash</Chip>
              <Chip quiet>+36 more</Chip>
              <Chip quiet>× Clear</Chip>
            </ChipPanel>
            <p className="ss-small">Sentence case and smaller than a pill, because there can be dozens. Selected is the same solid olive. The panel opens inside the sticky zone, so it pins with the filter bar.</p>
          </Specimen>
          <Specimen label="Search field: header · filter row · with a value and the save heart · with suggestions">
            <div className="ss-stack">
              <SearchField size="bar" value="" onChange={noop} placeholder="Brand, model, reference" />
              <SearchField size="row" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder="Search…"
                           trailing={<Pill icon={<span aria-hidden>♡</span>} aria-label="Save this search" title="Save this search" />} />
              <div className="ss-drop-demo">
                <SearchField size="row" value="" onChange={noop} placeholder="Brand, model, reference">
                  <SavedSuggestions />
                </SearchField>
              </div>
            </div>
          </Specimen>
          <Specimen label="Sub-tabs: segmented, solid olive when active (the Saved tab is the heart alone)">
            <SubTabs activeKey={tab} onSelect={setTab} tabs={WATCH_TABS} ariaLabel="Segmented" />
          </Specimen>
          <Specimen label="Count · account disc">
            <div className="ss-row"><Count>5 guides</Count><AccountDisc initial="M" /><AccountDisc initial="J" /></div>
          </Specimen>
        </Section>

        <Section id="pages" title="4 · Composed pages"
                 note="Two real tabs built only from the pieces above, at desktop and at phone width. Click around: tabs, pills, the heart, the search (focus the Watches search to see saved searches).">
          <Specimen label="Price range · buttons · the phone filter sheet">
            <div className="ss-stack">
              <PriceDemo />
              <div className="ss-row">
                <Button primary>Show 1,234 watches</Button>
                <Button>Reset</Button>
                <SheetDemo />
              </div>
            </div>
            <p className="ss-small">Price range sits inline on a desktop filter bar and moves into the sheet on a phone, where one Filter pill (with the applied count) replaces Source, Brand and Model. The sheet floats above Lumé's launcher so its primary button is never covered.</p>
          </Specimen>
          <Specimen label="Inside a page: section head (a list's name) · dismissable filters · jump nav · primary action">
            <div className="ss-stack" style={{ maxWidth: 760 }}>
              <SectionHead onExit={noop} exitLabel="All lists" title="JLC shortlist" meta="Shared by Sam"
                actions={[{ label: "Screen", onClick: noop }, { label: "Share", onClick: noop }]} />
              <div className="ui-dismiss-row">
                <DismissChip label="Rolex" onRemove={noop}>Rolex</DismissChip>
                <DismissChip label="Under $15,000" onRemove={noop}>Under $15,000</DismissChip>
              </div>
              <JumpNav ariaLabel="Sections" activeKey="watches" onGo={noop}
                items={[{ key: "notes", label: "Notes" }, { key: "watches", label: "Watches" }, { key: "articles", label: "Articles" }]} />
              <div className="ss-row">
                <Pill>+ Add a watch</Pill>
                <Pill primary>+ From feed</Pill>
                <Button primary inline>Sign in</Button>
              </div>
            </div>
            <p className="ss-small">The heading for a thing on the page (not a page title: the sub-tab already says where you are), with its actions as pills and a quiet way back. A selected filter you can take off is a dismissable chip; a long page gets a jump nav that pins under the chrome; the one main action in a group is a primary pill.</p>
          </Specimen>
          <Specimen label="A dialog: title, note, field, actions · a settings sheet (segmented choices) · a list picker">
            <div className="ss-modal-row">
              <div className="ss-modal-stage">
                <Modal title="New list" onClose={noop} width={380}>
                  <ModalNote>Group watches by reference, theme, or research thread.</ModalNote>
                  <FieldLabel>Name</FieldLabel>
                  <Input placeholder="List name" />
                  <ModalFoot><Button small>Cancel</Button><Button small primary>Create</Button></ModalFoot>
                </Modal>
              </div>
              <div className="ss-modal-stage">
                <Modal title="Settings" onClose={noop} width={380} sheet>
                  <ModalLabel>Primary currency</ModalLabel>
                  <SubTabs block choice ariaLabel="Primary currency" activeKey="USD" onSelect={noop}
                    tabs={[{ key: "USD", label: "$ USD" }, { key: "GBP", label: "£ GBP" }, { key: "EUR", label: "€ EUR" }]} />
                  <ModalLabel>Theme</ModalLabel>
                  <SubTabs block choice ariaLabel="Theme" activeKey="light" onSelect={noop}
                    tabs={[{ key: "light", label: "Light" }, { key: "dark", label: "Dark" }]} />
                </Modal>
              </div>
              <div className="ss-modal-stage">
                <Modal title="Add to list" onClose={noop} width={380} sheet
                       headAction={<Button small primary>Done</Button>}>
                  <div className="ui-pickrow-list">
                    <PickRow checked meta="3 items">Vintage divers</PickRow>
                    <PickRow checked={false} meta="12 items">Rolex 5513s</PickRow>
                  </div>
                  <Button block small>+ Create new list</Button>
                </Modal>
              </div>
            </div>
            <p className="ss-small">Every dialog is one shell: a scrim, the card, the Bodoni title with its close, an optional note, fields, and a right-aligned row of actions (Cancel is ghost, the main action solid olive, a destructive confirm solid red). A settings dialog pins its head and scrolls its body, and a choice among a few options is the segmented control announced as a radio group. A list picker uses one row per list.</p>
          </Specimen>
          <Specimen label="The account control: signed in (menu open) · signed out (menu open)">
            <div className="ss-row" style={{ gap: 40, alignItems: "flex-start", minHeight: 270, justifyContent: "flex-end" }}>
              <AccountMenu signedIn initial="M" defaultOpen>
                <AccountMenuHead name="Mark Mutter" onSignOut={noop} />
                <MenuItem>Lists</MenuItem>
                <MenuItem>My Watchbox</MenuItem>
                <MenuItem>Size comparison</MenuItem>
                <MenuItem badge="Admin">Site stats</MenuItem>
                <AccountMenuSection><Count>Display settings sit here</Count></AccountMenuSection>
              </AccountMenu>
              <AccountMenu defaultOpen>
                <MenuItem className="ui-menu-item--lead">Sign in with Google</MenuItem>
                <MenuItem>About Watchlist</MenuItem>
                <MenuItem>Display settings</MenuItem>
              </AccountMenu>
            </div>
            <p className="ss-small">One olive disc with the initial on every tab (a "Sign in" pill when signed out), and one panel under it: who you are with Sign out beside it, the rows, then the display settings. An outside press or Escape closes it.</p>
          </Specimen>
          <Specimen label="On an image: heart (saved is olive, never red) · the ⋯ and its menu · small, for tight grids · a remove × · the paper paddle · the plain ⋯ on a page · the add tile">
            <div className="ss-row" style={{ gap: 28, alignItems: "flex-start" }}>
              <div style={{ position: "relative", width: 220, height: 130, borderRadius: 8, background: "linear-gradient(135deg, #6b6b60, #2b2b27)" }}>
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <OverlayHeart on aria-label="Save" onClick={noop} />
                  <OverlayMenu>
                    <MenuItem>Share</MenuItem>
                    <MenuItem>Add to list…</MenuItem>
                    <MenuItem danger>Remove</MenuItem>
                  </OverlayMenu>
                </div>
              </div>
              <div style={{ position: "relative", width: 150, height: 90, borderRadius: 8, background: "linear-gradient(135deg, #6b6b60, #2b2b27)" }}>
                <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 6 }}>
                  <OverlayHeart small aria-label="Save" onClick={noop} />
                  <OverlayButton small aria-label="Remove" onClick={noop}>&times;</OverlayButton>
                </div>
              </div>
              <div className="ss-row" style={{ gap: 10 }}>
                <OverlayButton light aria-label="Scroll left">&lsaquo;</OverlayButton>
                <OverlayMenu plain label="List options"><MenuItem>Rename</MenuItem><MenuItem danger>Delete</MenuItem></OverlayMenu>
              </div>
              <AddTile title="Start a list" hint="Pick a watch or reference." minHeight={110} style={{ width: 170 }} />
            </div>
            <p className="ss-small">The heart and the ⋯ that sit on a card, an article, a guide, an auction cover or a list tile are these, nothing else: 34px (26px in a tight grid), dark glass that reads on any photo, olive when saved. The menu opens under its button, outside the card so nothing clips it, and a press inside it never follows the card's link.</p>
          </Specimen>
          <Specimen label="A takeover header (the auction catalog) and a stacked filter bar">
            <div className="ss-stack" style={{ maxWidth: 760 }}>
              <div>
                <div className="ui-takeover">
                  <div className="ui-takeover-text">
                    <div className="ui-takeover-eyebrow">Bonhams · Online, Paris · 8 - 22 October</div>
                    <div className="ui-takeover-title">Paris Watches Online</div>
                  </div>
                  <button type="button" className="ui-takeover-x" aria-label="Back to auction calendar">×</button>
                </div>
                <div className="ui-takeover-acts">
                  <Pill icon={<span aria-hidden>♡</span>}>Save catalog</Pill>
                  <Pill>Share</Pill>
                  <Pill href="https://example.com">Auction house ↗</Pill>
                </div>
              </div>
              <div className="ui-frame" style={{ background: "transparent" }}>
                <FilterBar stacked count="114 watches"
                  pills={<><Pill>Auction calendar</Pill><Pill>Source</Pill><Pill>Brand</Pill></>}
                  search={<SearchField size="row" value="" onChange={noop} placeholder="Brand, model, reference" />}
                  end={<><PriceDemo /><Pill on>Date ↓</Pill><Pill>Price</Pill></>} />
              </div>
            </div>
            <p className="ss-small">A focused full page (one auction sale) swaps the tab header for its own olive title bar, with the sale as a mono eyebrow, and a quiet row of actions that are the same pills. Its filter bar carries a search of its own plus the calendar, so it stacks: search on its own row, pills and controls under it. Every other page keeps the header and the one-line bar.</p>
          </Specimen>
          <h3 className="ss-h3">Articles-like (no sub-tabs: the filter bar sits straight under the header)</h3>
          <div className="ss-screen"><ArticlesPage /></div>
          <div className="ss-phones">
            <div className="ss-phone"><ArticlesPage phone /></div>
            <div className="ss-phone"><WatchesPage phone /></div>
          </div>
          <h3 className="ss-h3">Watches-like (sub-tabs with the count, then the filter bar)</h3>
          <div className="ss-screen"><WatchesPage /></div>
        </Section>

        <LumeSection />

        <Section id="decisions" title="7 · Decisions made (2026-10-17)"
                 note="Where today's pages disagreed, Mark chose. The loser of each is deleted as its tab migrates.">
          <ul className="ss-picks">
            <li><b>D1 · Sub-tabs:</b> segmented (the track with a solid chip). The underline form is retired.</li>
            <li><b>D2 · Selected pill:</b> solid olive. The olive tint is retired.</li>
            <li><b>D3 · Page title:</b> none. The header's active tab says where you are; each page gains about 60px.</li>
            <li><b>D4 · Header type:</b> the front page's Bodoni wordmark and mono tab labels, on every tab; system sans below the header.</li>
            <li><b>D5 · Watches' Saved tab:</b> the heart alone (its accessible name is still "Saved").</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
