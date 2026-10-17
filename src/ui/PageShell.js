// PageShell — the header and the page chrome for any tab that is not wrapped by
// the legacy shells (DesktopShell / MobileShell). It is the second half of the
// shared frame: src/ui supplies the pieces, this supplies the page they sit in.
//
//   desktop: the one sticky header bar (wordmark · tabs · [search] · heart · account)
//   phone:   the brand row (scrolls away) + the tab row (sticks), and the search
//            row under it when the page seats its own search (Watches)
//   header:  a page that is a focused takeover (the auction catalog) hands in its own
//            pinned header instead; the shell measures it, so a sticky filter bar still
//            pins right under it
//   bare:    no header at all, for Home, whose masthead is part of its own page
//
// The window scrolls (like the Watches page), so a page's sticky filter bar pins
// under the header at --ui-header-h. The overlays, About and sign-in modals the
// shells render at their tail are rendered here too, so a control on the page
// (share, add to list, settings) opens something.

import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagazineShellBar, MagazineBrandRow, MagazineTabRow } from "../components/MagazineShellBar";
import { AboutModal } from "../components/AboutModal";
import { SignInPromptModal } from "../components/SignInPromptModal";
import "./ui.css";

// A page's search lives in the header, at the same place and size on every page (Mark,
// 2026-10-17: "all still different size boxes and y axis locations"). The page that owns the
// search state renders <HeaderSearch>...</HeaderSearch>; the shell makes room for it in the
// header (a slot in the desktop bar, a row under the phone's tabs) and the field is portalled
// into it. A page with no search renders no slot, so nothing is reserved. Outside a PageShell
// (a component test, say) it just renders inline.
const SearchSlotContext = createContext(null);

export function HeaderSearch({ children }) {
  const ctx = useContext(SearchSlotContext);
  const setWanted = ctx && ctx.setWanted;
  useLayoutEffect(() => {
    if (!setWanted) return undefined;
    setWanted(true);
    return () => setWanted(false);
  }, [setWanted]);
  if (!ctx) return children;
  return ctx.slotEl ? createPortal(children, ctx.slotEl) : null;
}

export function PageShell({
  isMobile, baseStyle, tabs, authJSX, user, onHome, goToSaved, searchJSX,
  overlaysJSX, aboutModalOpen, setAboutModalOpen, signInPromptOpen, setSignInPromptOpen,
  signInWithGoogle, primaryCurrency, children, header, bare,
}) {
  const root = useRef(null);
  const pinned = useRef(null);
  const [slotEl, setSlotEl] = useState(null);
  const [wanted, setWanted] = useState(false);
  const slotCtx = useMemo(() => ({ slotEl, setWanted }), [slotEl]);
  // The page's own search element wins (Watches, a list); otherwise the slot, if a child asked.
  const searchEl = searchJSX || (wanted ? <div className="ui-search-slot" ref={setSlotEl} /> : null);
  // A window-scrolled page opens at the top. The shells scrolled an inner pane that
  // reset itself; the window keeps whatever offset the previous tab had.
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, []);
  // A page-supplied header has no fixed height, so say how tall it is (the filter bar
  // pins at --ui-header-h and dividers stick below that).
  useLayoutEffect(() => {
    const el = pinned.current;
    const page = root.current;
    if (!header || !el || !page) return undefined;
    const publish = () => page.style.setProperty("--ui-header-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", publish);
      page.style.removeProperty("--ui-header-h");
    };
  }, [header]);
  return (
    <div ref={root}
         className={`ui-page${isMobile ? " ui-page--phone" : ""}${isMobile && searchEl && !header && !bare ? " ui-page--phone-search" : ""}`}
         style={baseStyle}>
      {bare ? null : header ? (
        <div ref={pinned} className="ui-page-stick">{header}</div>
      ) : isMobile ? (
        <>
          <MagazineBrandRow authJSX={authJSX} showSaved={!!user} onSavedClick={goToSaved}
                            onHome={onHome} />
          <div className="ui-page-stick">
            <MagazineTabRow tabs={tabs} />
            {searchEl ? <div className="ui-page-search">{searchEl}</div> : null}
          </div>
        </>
      ) : (
        <MagazineShellBar tabs={tabs} authJSX={authJSX} showSaved={!!user} onSavedClick={goToSaved}
                          onHome={onHome} searchJSX={searchEl} />
      )}
      <SearchSlotContext.Provider value={slotCtx}>{children}</SearchSlotContext.Provider>
      {overlaysJSX}
      <AboutModal open={!!aboutModalOpen} onClose={() => setAboutModalOpen && setAboutModalOpen(false)}
                  primaryCurrency={primaryCurrency} />
      <SignInPromptModal open={!!signInPromptOpen}
                         onClose={() => setSignInPromptOpen && setSignInPromptOpen(false)}
                         onSignIn={() => signInWithGoogle && signInWithGoogle()} />
    </div>
  );
}
