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

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { MagazineShellBar, MagazineBrandRow, MagazineTabRow } from "../components/MagazineShellBar";
import { AboutModal } from "../components/AboutModal";
import { SignInPromptModal } from "../components/SignInPromptModal";
import "./ui.css";

export function PageShell({
  isMobile, baseStyle, tabs, authJSX, user, onHome, goToSaved, chromeFaces, searchJSX,
  overlaysJSX, aboutModalOpen, setAboutModalOpen, signInPromptOpen, setSignInPromptOpen,
  signInWithGoogle, primaryCurrency, children, header, bare,
}) {
  const root = useRef(null);
  const pinned = useRef(null);
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
         className={`ui-page${isMobile ? " ui-page--phone" : ""}${isMobile && searchJSX && !header && !bare ? " ui-page--phone-search" : ""}`}
         style={baseStyle}>
      {bare ? null : header ? (
        <div ref={pinned} className="ui-page-stick">{header}</div>
      ) : isMobile ? (
        <>
          <MagazineBrandRow authJSX={authJSX} showSaved={!!user} onSavedClick={goToSaved}
                            onHome={onHome} faces={chromeFaces} />
          <div className="ui-page-stick">
            <MagazineTabRow tabs={tabs} faces={chromeFaces} />
            {searchJSX ? <div className="ui-page-search">{searchJSX}</div> : null}
          </div>
        </>
      ) : (
        <MagazineShellBar tabs={tabs} authJSX={authJSX} showSaved={!!user} onSavedClick={goToSaved}
                          onHome={onHome} faces={chromeFaces} searchJSX={searchJSX} />
      )}
      {children}
      {overlaysJSX}
      <AboutModal open={!!aboutModalOpen} onClose={() => setAboutModalOpen && setAboutModalOpen(false)}
                  primaryCurrency={primaryCurrency} />
      <SignInPromptModal open={!!signInPromptOpen}
                         onClose={() => setSignInPromptOpen && setSignInPromptOpen(false)}
                         onSignIn={() => signInWithGoogle && signInWithGoogle()} />
    </div>
  );
}
