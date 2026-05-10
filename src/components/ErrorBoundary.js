import React from "react";

// Tiny React error boundary so a render-time throw inside the wrapped
// subtree doesn't unmount the whole app to a white screen. Used
// 2026-05-10 around the Lists drill-in after Jackie hit a white
// screen on Mark's "Watches for Jackie" — without a boundary we
// had no way to capture the error from a mobile-Safari session.
//
// Also exposes the error message inline so the user can screenshot
// it for the maintainer. Stays stable + tactile (no spinners, no
// retry button) — the goal is to get a useful report, not to hide
// the bug.

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Console-log so the error shows up in the browser console for
    // a screenshot. Don't ship to a backend — privacy notice would
    // need an entry first, and Mark's user base is small enough
    // that direct screenshots are the right loop.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      const msg = (this.state.error && this.state.error.message) || String(this.state.error);
      const stack = (this.state.error && this.state.error.stack) || "";
      return (
        <div style={{
          padding: "20px 16px",
          fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif",
          color: "var(--text1)",
          background: "var(--bg)",
          minHeight: "100vh",
        }}>
          <div style={{
            fontSize: 16, fontWeight: 600, marginBottom: 6,
          }}>Something broke on this view</div>
          <div style={{
            fontSize: 13, color: "var(--text2)", marginBottom: 14, lineHeight: 1.5,
          }}>
            Screenshot this and send it to Mark — he'll get it fixed. Tapping back will return to the list view.
          </div>
          <button onClick={() => this.setState({ error: null })}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--surface)", color: "var(--text1)",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13,
              marginBottom: 14,
            }}>Try again</button>
          <pre style={{
            fontSize: 11, color: "var(--text3)",
            background: "var(--surface)",
            padding: "10px 12px", borderRadius: 8,
            border: "0.5px solid var(--border)",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            marginTop: 6,
          }}>{msg}</pre>
          {stack && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: "var(--text3)", cursor: "pointer" }}>Stack</summary>
              <pre style={{
                fontSize: 10, color: "var(--text3)",
                background: "var(--surface)",
                padding: "10px 12px", borderRadius: 8,
                border: "0.5px solid var(--border)",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                marginTop: 6, maxHeight: 280, overflowY: "auto",
              }}>{stack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
