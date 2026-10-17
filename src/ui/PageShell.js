// PageShell — the header and the page chrome for any tab that is not wrapped by
// the legacy shells (DesktopShell / MobileShell). It is the second half of the
// shared frame: src/ui supplies the pieces, this supplies the page they sit in.
//
//   desktop: the one sticky header bar (wordmark · tabs · [search] · heart · account)
//   phone:   the brand row (scrolls away) + the tab row (sticks)
//
// The window scrolls (like the Watches page), so a page's sticky filter bar pins
// under the header at --ui-header-h. The overlays, About and sign-in modals the
// shells render at their tail are rendered here too, so a control on the page
// (share, add to list, settings) opens something.

import React, { useEffect } from "react";
import { MagazineShellBar, MagazineBrandRow, MagazineTabRow } from "../components/MagazineShellBar";
import { AboutModal } from "../components/AboutModal";
import { SignInPromptModal } from "../components/SignInPromptModal";
import "./ui.css";

export function PageShell({
  isMobile, baseStyle, tabs, authJSX, user, onHome, goToSaved, chromeFaces, searchJSX,
  overlaysJSX, aboutModalOpen, setAboutModalOpen, signInPromptOpen, setSignInPromptOpen,
  signInWithGoogle, primaryCurrency, children,
}) {
  // A window-scrolled page opens at the top. The shells scrolled an inner pane that
  // reset itself; the window keeps whatever offset the previous tab had.
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, []);
  return (
    <div className={`ui-page${isMobile ? " ui-page--phone" : ""}`} style={baseStyle}>
      {isMobile ? (
        <>
          <MagazineBrandRow authJSX={authJSX} showSaved={!!user} onSavedClick={goToSaved}
                            onHome={onHome} faces={chromeFaces} />
          <div className="ui-page-stick"><MagazineTabRow tabs={tabs} faces={chromeFaces} /></div>
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
