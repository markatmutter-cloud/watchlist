import React from "react";

// Non-modal banner shown above a listing's Card when the user opens a
// share link (?listing=<id>&shared=1). Two variants:
//
// - Signed-in:   "Save" / "Dismiss" actions. Save adds to default
//                Favorites + Shared with me; Dismiss adds only to
//                Shared with me. Both clear the banner + URL params.
// - Anonymous:   passive Dismiss + optional "Sign in to save" CTA.
//                No data written until they sign in. Spec is explicit:
//                no growth-funnel friction, no nag.
//
// Sender identity isn't exposed in v1 (Q7 default). The sender is
// identified through whatever messaging app the link came in.
//
// Defensively pure: no internal state, no async side effects, no
// hooks. Parent owns everything; this is a presentation shell.
export function ShareBanner({ onSave, onDismiss, onSignIn, signedIn, busy }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      padding: "12px 16px",
      borderRadius: 10,
      background: "var(--surface)",
      border: "0.5px solid var(--border)",
      borderLeft: "3px solid #185FA5",
      marginBottom: 12,
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 2 }}>
          Shared with you on Watchlist
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.4 }}>
          {signedIn
            ? "Save adds it to your Favorites and a separate \"Shared with me\" list. Dismiss keeps it in \"Shared with me\" only."
            : "Sign in to save it. Or browse the dealer link from the card below."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {signedIn ? (
          <>
            <button onClick={onDismiss} disabled={busy} style={{
              border: "0.5px solid var(--border)", background: "transparent",
              color: "var(--text2)", padding: "8px 14px", borderRadius: 8,
              cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13,
            }}>Dismiss</button>
            <button onClick={onSave} disabled={busy} style={{
              border: "none", background: "#185FA5", color: "#fff",
              padding: "8px 14px", borderRadius: 8,
              cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13,
              fontWeight: 500, opacity: busy ? 0.6 : 1,
            }}>{busy ? "Saving…" : "Save"}</button>
          </>
        ) : (
          <>
            <button onClick={onDismiss} style={{
              border: "0.5px solid var(--border)", background: "transparent",
              color: "var(--text2)", padding: "8px 14px", borderRadius: 8,
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
            }}>Dismiss</button>
            {onSignIn && (
              <button onClick={onSignIn} style={{
                border: "none", background: "#185FA5", color: "#fff",
                padding: "8px 14px", borderRadius: 8,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              }}>Sign in to save</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
