// Which "shared with you" surface the URL asks for, read synchronously.
//
// The receivers (ShareReceiver, ListReceiver, ChallengeReceiver,
// CatalogReceiver) detect their intent in an effect and only then flip App's
// one-bit `*ShareActive` flags. But App only MOUNTS the receivers inside the
// generic page, which it shows only once a flag is already on. On a cold load
// of a share link nothing was mounted to flip the flag, so the recipient
// landed on Home (Mark 2026-10-23). App seeds its flags from this instead, so
// the receiver is on the page from the first render.
export function receiveIntentFromUrl(search) {
  let p;
  try { p = new URLSearchParams(search || ""); } catch { p = new URLSearchParams(); }
  const shared = p.get("shared") === "1";
  return {
    share: shared && !!p.get("listing"),
    list: shared && !!p.get("list"),
    challenge: (p.get("newchallenge") === "1"
      && parseInt(p.get("n") || "0", 10) > 0 && parseInt(p.get("b") || "0", 10) > 0)
      || (shared && !!p.get("challenge")),
    catalog: shared && !!p.get("catalog"),
  };
}

export function initialReceiveIntent() {
  if (typeof window === "undefined") return receiveIntentFromUrl("");
  return receiveIntentFromUrl(window.location.search);
}

// A receiver's own id param, read synchronously for its useState initialiser
// so the receiver reports "active" on its very first effect. Reading it in a
// mount effect instead let the first mirror run report false, which unmounted
// the receiver in the same batch that set its intent.
export function sharedParam(name) {
  if (typeof window === "undefined") return null;
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("shared") === "1" ? (p.get(name) || null) : null;
  } catch { return null; }
}
