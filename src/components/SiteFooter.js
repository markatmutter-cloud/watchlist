import React from "react";
import { Button } from "../ui";

// The site footer. Lived inside HomeTab until the magazine replaced that page
// (2026-09-07); pulled out so nothing depends on a retired component.
//
// Closes the page rather than letting it trail off: hairline rule above the
// link row, small centred text. About + Privacy + Terms always; Sign in only
// when signed out.
export function FooterBand({ openAbout, signInWithGoogle, user }) {
  return (
    <footer style={{
      marginTop: 24,
      padding: "24px 16px 16px",
      borderTop: "0.5px solid var(--border)",
      textAlign: "center",
    }}>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
        <Button link muted onClick={openAbout}>About</Button>
        <Button link muted href="/privacy.html">Privacy</Button>
        <Button link muted href="/terms.html">Terms</Button>
        {!user && signInWithGoogle && (
          <Button link muted onClick={signInWithGoogle}>Sign in</Button>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 14 }}>
        © Watchlist · 2026
      </div>
    </footer>
  );
}

