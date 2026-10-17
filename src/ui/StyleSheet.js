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
  Pill, SavedPill, SearchField, SubTabs, PageTitle, FilterBar, PageFrame, Count,
  AccountDisc, SuggestionRows,
} from "./index";
import { MagazineShellBar, MagazineBrandRow, MagazineTabRow } from "../components/MagazineShellBar";
import { FilterIcon } from "../components/icons";
import "./StyleSheet.css";

const noop = () => {};

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

function ArticlesPage({ phone, title = true, tabsVariant }) {
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <>
      {phone
        ? <><MagazineBrandRow authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />
            <MagazineTabRow tabs={demoTabs("articles")} /></>
        : <MagazineShellBar tabs={demoTabs("articles")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />}
      <PageFrame
        title={title ? "Articles" : null}
        filterBar={
          <FilterBar
            pills={<><TogglePill>Source</TogglePill><TogglePill>Brand</TogglePill>
                    <SavedPill on={saved} onClick={() => setSaved((v) => !v)} what="saved articles" /></>}
            search={<SearchField size={phone ? "full" : "row"} value={q} onChange={(e) => setQ(e.target.value)}
                                  onClear={() => setQ("")} placeholder="Search articles…" ariaLabel="Search articles" />}
            count="11,288 articles" />
        }>
        <Cards n={phone ? 3 : 8} />
      </PageFrame>
    </>
  );
}

function WatchesPage({ phone, tabsVariant = "segmented" }) {
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
      {phone
        ? <><MagazineBrandRow authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />
            <div className="ss-phone-stick"><MagazineTabRow tabs={demoTabs("listings")} />
              <div className="ss-phone-search">{search}</div></div></>
        : <MagazineShellBar tabs={demoTabs("listings")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop}
                            onHome={noop} searchJSX={search} />}
      <PageFrame
        subTabs={<SubTabs variant={tabsVariant} ariaLabel="Watches views" activeKey={sub} onSelect={setSub}
                          tabs={[{ key: "live", label: "For sale" }, { key: "auctions", label: "Auctions" },
                                 { key: "sold", label: "Sold" }, { key: "saved", label: "♡ Saved" }]} />}
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

// ---- the page ------------------------------------------------------------------------------------

export default function StyleSheet({ tabs, authJSX, onHome, isMobile }) {
  const [saved, setSaved] = useState(false);
  const [q, setQ] = useState("Submariner");
  const [tabA, setTabA] = useState("live");
  const [tabB, setTabB] = useState("live");
  const subTabs = [{ key: "live", label: "For sale" }, { key: "auctions", label: "Auctions" },
                   { key: "sold", label: "Sold" }, { key: "saved", label: "♡ Saved" }];
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
            Every tab below the header is built from the pieces on this page and nothing else. Approve them here
            once, and every tab moves over to match; nothing gets restyled page by page. Everything shown is the
            real component, and the phone frames are real 390px containers, so you can judge the phone layout from
            a desktop window (or open this page on your phone).
          </p>
          <p className="ss-lede">
            <strong>To approve:</strong> look through sections 1–4, then pick an option in each of the five
            decisions in section 5 (e.g. "D1 A, D2 A, D3 A, D4 A, D5 A"). Anything you want changed, say so by name.
          </p>
        </header>

        <Section id="anatomy" title="1 · The page anatomy"
                 note="Every page is these five bands, in this order, at one left edge (20px; 16px on a phone). Any band can be absent; none can move.">
          <ol className="ss-anatomy">
            <li><b>Header bar</b>: wordmark · tabs · (Watches only: its search) · heart · account. 56px, every tab. Home keeps its masthead.</li>
            <li><b>Page title</b>: optional (decision D3).</li>
            <li><b>Sub-tabs</b>: optional; "where you are" (decision D1). The count can sit at their right.</li>
            <li><b>Filter bar</b>: pills left · search centred · count right. On a phone the search takes its own row above.</li>
            <li><b>Content</b>: cards, lists, whatever the page is for.</li>
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
            <div><span className="ss-type-w">WATCHLIST</span><code>19px · 700 · tracked: wordmark</code></div>
            <div><span className="ss-type-h">Articles</span><code>28px (23 phone) · 700: page title</code></div>
            <div><span className="ss-type-t">For sale</span><code>17px · 500 / 600: underline sub-tab</code></div>
            <div><span className="ss-type-l">SOURCE · 11,288 ARTICLES</span><code>11px · tracked caps: pills, counts, eyebrows</code></div>
            <div><span className="ss-type-b">Search articles, brand, model, reference</span><code>14px: fields and body</code></div>
          </div>
          <table className="ss-table">
            <tbody>
              <tr><td>Page edge</td><td>20px · 16px phone</td></tr>
              <tr><td>Header bar</td><td>56px</td></tr>
              <tr><td>Pills</td><td>36px · 40px phone</td></tr>
              <tr><td>Search field</td><td>38px · 44px phone</td></tr>
              <tr><td>Account disc</td><td>36px · 40px phone</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="pieces" title="3 · The pieces"
                 note="Each is one component in src/ui. Change it there and it changes everywhere.">
          <Specimen label="Header bar: Watches (search seated in it) and the rest">
            <div className="ss-bar-demo">
              <MagazineShellBar tabs={demoTabs("listings")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop}
                searchJSX={<SearchField size="bar" value="" onChange={noop} placeholder="Brand, model, reference" />} />
              <MagazineShellBar tabs={demoTabs("articles")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />
            </div>
          </Specimen>
          <Specimen label="Header bar: phone (brand row scrolls away; tabs stay)">
            <div className="ss-phone-box">
              <MagazineBrandRow authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} />
              <MagazineTabRow tabs={demoTabs("articles")} />
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
            <p className="ss-small">Click them. The heart is a bare icon: no word, never red, olive when on. Selected is a quiet olive tint on purpose: the sub-tab is "where you are", a pill is "how you narrowed it".</p>
          </Specimen>
          <Specimen label="Search field: header · filter row · phone · with a value · with the save heart · with suggestions">
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
          <Specimen label="Sub-tabs: segmented and underline (decision D1)">
            <div className="ss-stack">
              <SubTabs variant="segmented" activeKey={tabA} onSelect={setTabA} tabs={subTabs} ariaLabel="Segmented" />
              <SubTabs variant="underline" activeKey={tabB} onSelect={setTabB} tabs={subTabs} ariaLabel="Underline" />
            </div>
          </Specimen>
          <Specimen label="Page title · count · account disc">
            <PageTitle title="Reference guides" actions={<Count>5 guides</Count>} />
            <div className="ss-row" style={{ marginTop: 14 }}><AccountDisc initial="M" /><AccountDisc initial="J" /></div>
          </Specimen>
        </Section>

        <Section id="pages" title="4 · Composed pages"
                 note="Two real tabs built only from the pieces above, at desktop and at phone width. Click around: tabs, pills, the heart, the search (focus the Watches search to see saved searches).">
          <h3 className="ss-h3">Articles-like (title · filter bar with search in the row)</h3>
          <div className="ss-screen"><ArticlesPage /></div>
          <div className="ss-phones">
            <div className="ss-phone"><ArticlesPage phone /></div>
            <div className="ss-phone"><WatchesPage phone /></div>
          </div>
          <h3 className="ss-h3">Watches-like (no title · sub-tabs with the count · search seated in the header)</h3>
          <div className="ss-screen"><WatchesPage /></div>
        </Section>

        <Section id="decisions" title="5 · Decisions for you"
                 note="Where today's pages disagree, both versions are shown. Pick one in each; the other is deleted.">
          <div className="ss-decision">
            <h3 className="ss-h3">D1 · Sub-tabs</h3>
            <div className="ss-ab">
              <div><b>A · Segmented</b> (Articles/Saved today; chosen after the June usability audit: people missed underline tabs)<br /><br />
                <SubTabs variant="segmented" activeKey="live" onSelect={noop} tabs={subTabs} /></div>
              <div><b>B · Underline</b> (Watches today)<br /><br />
                <SubTabs variant="underline" activeKey="live" onSelect={noop} tabs={subTabs} /></div>
            </div>
          </div>
          <div className="ss-decision">
            <h3 className="ss-h3">D2 · Selected pill</h3>
            <div className="ss-ab">
              <div><b>A · Olive tint</b> (most of the site today)<br /><br />
                <div className="ss-row"><Pill>Source</Pill><Pill on>Brand</Pill><Pill on n={2}>Model</Pill></div></div>
              <div><b>B · Solid olive</b> (Watches' sort pills today)<br /><br />
                <div className="ss-row"><Pill solid>Source</Pill><Pill solid on>Brand</Pill><Pill solid on n={2}>Model</Pill></div></div>
            </div>
          </div>
          <div className="ss-decision">
            <h3 className="ss-h3">D3 · Page title</h3>
            <div className="ss-ab">
              <div><b>A · A title on every page</b> (Articles and Guides today)
                <div className="ss-mini"><PageFrame title="Articles" filterBar={<FilterBar pills={<><Pill>Source</Pill><Pill>Brand</Pill></>} count="11,288 articles" />}><div style={{ height: 10 }} /></PageFrame></div></div>
              <div><b>B · No title</b> (Watches today; the header's active tab already says where you are, and it saves ~60px)
                <div className="ss-mini"><PageFrame filterBar={<FilterBar pills={<><Pill>Source</Pill><Pill>Brand</Pill></>} count="11,288 articles" />}><div style={{ height: 10 }} /></PageFrame></div></div>
            </div>
          </div>
          <div className="ss-decision">
            <h3 className="ss-h3">D4 · Header type</h3>
            <div className="ss-ab ss-ab--stack">
              <div><b>A · System type</b> (today, everywhere except Home)
                <div className="ss-bar-demo"><MagazineShellBar tabs={demoTabs("articles")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} faces="system" /></div></div>
              <div><b>B · Bodoni wordmark + mono tabs</b> (the front page's chrome; the working UI below stays system sans)
                <div className="ss-bar-demo"><MagazineShellBar tabs={demoTabs("articles")} authJSX={<AccountDisc initial="M" />} showSaved onSavedClick={noop} onHome={noop} faces="display" /></div></div>
            </div>
          </div>
          <div className="ss-decision">
            <h3 className="ss-h3">D5 · The Saved sub-tab on Watches</h3>
            <div className="ss-ab">
              <div><b>A · Word and heart</b> (today)<br /><br />
                <SubTabs variant="underline" activeKey="live" onSelect={noop} tabs={subTabs} /></div>
              <div><b>B · Heart only</b> (matches the icon-only pills; it is a navigation tab, and first-time users scan for words)<br /><br />
                <SubTabs variant="underline" activeKey="live" onSelect={noop}
                         tabs={[...subTabs.slice(0, 3), { key: "saved", label: "♡" }]} /></div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
