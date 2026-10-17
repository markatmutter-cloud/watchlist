import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import { dispatchAction, resolveItemByUrl } from "./ActionBus";
import { Chip } from "../ui";
import LumeInput from "./LumeInput";
import { SpeechRec } from "./lumeSpeech";

// LumeConversation — the conversation CORE shared across Lumé surfaces: the
// floating ChatBubbleHost (corner frame) and the desktop expanded-bubble canvas
// (LumeCanvas's chat rail). It owns the message list + composer render and the
// chat state/loop (via useLumeChat), so the surfaces can't drift in how a reply
// renders, how links route, or how the agentic send loop behaves. Surface-specific behaviour (minimise on action,
// how a watch link opens) is injected by the parent via onOpenItem/onActionResult.
//
// NB: solid-olive surfaces use #fff text, NOT --brand-olive-ink (that ink is the
// DARK sage for light olive *tints* — invisible on solid olive). (B-39)

export const NAME = "Lumé";

// Display-only opener — sets Lumé's voice + teaches the pronunciation; the
// substantive get_user_context-grounded cold open comes from the model.
export const GREETING =
  "I'm Lumé.\n\nSo, what's your watch problem?\n\nLate-night Speedmaster browsing? Talking yourself into a vintage Sub? I speak fluent Speedy, Sub, QP, gilt, tropical, ghost bezel, soft case, and \"why is this one somehow twice the price?\"\n\nGive me 3–5 watches you like, one you're thinking about buying, and a rabbit hole you want to go down. The more you give me, the better I'll be.\n\nWhat should we look at first?";

export const SUGGESTIONS = ["What should I look at?", "I'm into dive watches", "Surprise me"];

const LINK_STYLE = { color: "var(--brand)", textDecoration: "underline" };

// Re-exported for existing importers; the engine lives in ./lumeSpeech.
export { SpeechRec };

// "Share with Lumé" seed: compose the opening user message from a listing the
// user handed to Lumé via a card's ⋯ menu. Lumé resolves brand/model/ref (and
// the URL) with its tools and engages about THIS watch.
export function describeItem(it) {
  if (!it || typeof it !== "object") return "Tell me about this watch.";
  const bits = [it.brand, it.model || it.model_line, it.reference_id || it.reference_no]
    .filter(Boolean).join(" ").trim();
  const title = (it.title || bits || "this watch").toString().trim();
  const price = it.priceUSD ? `, $${Number(it.priceUSD).toLocaleString()}` : "";
  const src = it.source ? ` (${it.source})` : "";
  const url = it.url ? ` ${it.url}` : "";
  return `I'm looking at this listing: ${title}${price}${src}. What should I know about it?${url}`;
}

// Minimal rich-text renderer for assistant replies: **bold**, [md](links),
// bare URLs (→ clickable, new tab), line breaks. No markdown dep; React nodes.
// Tolerates a url wrapped in angle brackets — the model sometimes writes
// [label](<https://…>), which would otherwise fail to parse as a link and leak
// the raw markdown / a broken href.
const RICH = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(<?(https?:\/\/[^)\s>]+)>?\)|(https?:\/\/[^\s)>]+)/g;

// A link in Lumé's reply: if it resolves to a live watch we hold, open it IN-APP
// (the shared surface) instead of bouncing to the dealer site — Mark's "the body
// links are direct links, I want the shared surface" fix. Anything else (an
// article, a citation, a watch that's gone) stays a normal external link. The
// resolve check is synchronous so we never fall back to an async window.open()
// a popup-blocker would eat.
function renderLink(url, label, key, openInApp) {
  if (openInApp && resolveItemByUrl(url)) {
    return (
      <a key={key} href={url} onClick={(e) => { e.preventDefault(); openInApp(url); }} style={LINK_STYLE}>{label}</a>
    );
  }
  return <a key={key} href={url} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>{label}</a>;
}

export function renderInline(text, kp, openInApp) {
  const out = [];
  let last = 0, i = 0, m;
  RICH.lastIndex = 0;
  while ((m = RICH.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${kp}-${i}`}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      out.push(renderLink(m[3], m[2], `${kp}-${i}`, openInApp));   // [label](url)
    } else if (m[4] !== undefined) {
      out.push(renderLink(m[4], m[4], `${kp}-${i}`, openInApp));   // bare url
    }
    i += 1;
    last = RICH.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderRich(text, openInApp) {
  return String(text || "").split("\n").map((line, i) => (
    <React.Fragment key={i}>{i > 0 && <br />}{renderInline(line, `l${i}`, openInApp)}</React.Fragment>
  ));
}

// useLumeChat — the chat state + agentic send loop, independent of any surface.
// A parent owns one instance; the bubble keeps its own (ephemeral), the inline
// tab's lives in App so it survives the full-page share surface. runAction here
// deliberately does NOT minimise/navigate — it returns the result and the
// surface decides (the bubble minimises, the tab keeps the thread).
export function useLumeChat() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({});
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const send = useCallback(
    async (text) => {
      const content = (text || "").trim();
      if (!content || loading) return;
      setError("");
      setDraft("");
      const next = [...messages, { role: "user", content }];
      setMessages(next);
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) { setError("Please sign in again."); setLoading(false); return; }
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: next }),
        });
        if (res.status === 429) { setCapped(true); setLoading(false); return; }
        if (!res.ok) { setError("Something went wrong. Try again in a moment."); setLoading(false); return; }
        const body = await res.json();
        setMessages([...next, {
          role: "assistant",
          content: body.reply || "",
          actions: Array.isArray(body.actions) ? body.actions : [],
        }]);
      } catch {
        setError("Couldn't reach Lumé. Check your connection.");
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const runAction = useCallback(async (action, key) => {
    setActionState((s) => ({ ...s, [key]: { status: "running" } }));
    const res = await dispatchAction(action);
    setActionState((s) => ({ ...s, [key]: { status: res.ok ? "done" : "failed", message: res.message } }));
    return res;
  }, []);

  // Device-native dictation: append speech into the draft. (B-43)
  const toggleMic = useCallback(() => {
    if (!SpeechRec) return;
    if (listening) { try { recognitionRef.current && recognitionRef.current.stop(); } catch {} return; }
    let rec;
    try { rec = new SpeechRec(); } catch { return; }
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    const base = draft;
    rec.onresult = (e) => {
      let t = "";
      for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript;
      setDraft((base ? base.replace(/\s*$/, "") + " " : "") + t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }, [listening, draft]);

  useEffect(() => () => { try { recognitionRef.current && recognitionRef.current.stop(); } catch {} }, []);

  const reset = useCallback(() => {
    setMessages([]); setDraft(""); setError(""); setCapped(false); setActionState({});
  }, []);

  return {
    messages, setMessages, draft, setDraft, loading, capped, error, actionState, listening,
    send, runAction, toggleMic, reset, scrollRef, inputRef,
  };
}

// LumeConversation — presentational scroll area + composer. Stateless re: the
// chat (it reads/writes via the `chat` object from useLumeChat). The parent
// injects the surface-specific link/action behaviour and the cold-open copy.
export function LumeConversation({
  chat,
  greeting = GREETING,
  suggestions = SUGGESTIONS,
  onOpenItem,
  onActionResult,
  onAction,            // optional pre-handler: return true to intercept an action
                       // (e.g. route show_listings into the canvas, not the tab)
  isMobile = false,
  scrollStyle,
}) {
  const { messages, loading, capped, error, actionState, send, runAction, scrollRef, inputRef } = chat;

  // Keep the transcript pinned to the latest message. (The composer grows with its own
  // draft; that lives in LumeInput.)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, scrollRef]);

  const display = greeting ? [{ role: "assistant", content: greeting }, ...messages] : messages;

  return (
    <>
      <div ref={scrollRef} className="ui-lume-scroll" style={scrollStyle}>
        {display.map((m, i) => {
          const isUser = m.role === "user";
          const acts = !isUser && Array.isArray(m.actions) ? m.actions : [];
          return (
            <div key={i} className={`ui-lume-msg${isUser ? " ui-lume-msg--user" : ""}`}>
              {isUser
                ? <div className="ui-lume-bubble">{m.content}</div>
                : <div className="ui-lume-text">{renderRich(m.content, onOpenItem)}</div>}
              {acts.length > 0 && (
                <div className="ui-lume-acts">
                  {acts.map((a, ai) => {
                    const key = `${i}-${ai}`;
                    const st = actionState[key];
                    const failed = st && st.status === "failed";
                    const done = st && st.status === "done";
                    const running = st && st.status === "running";
                    return (
                      // Visited chips keep the ✓ but stay CLICKABLE (Mark: after
                      // opening a link I want to go back and re-open it). Only a
                      // chip mid-run is disabled.
                      <button key={ai} type="button" disabled={running}
                        className={`ui-lume-act${done ? " is-done" : ""}${failed ? " is-failed" : ""}`}
                        onClick={() => { if (onAction && onAction(a)) return; runAction(a, key).then((res) => onActionResult && onActionResult(a, res)); }}
                        title={failed ? st.message : undefined}>
                        {done ? "✓ " : ""}{a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {messages.length === 0 && !loading && suggestions.length > 0 && (
          <div className="ui-lume-chips">
            {suggestions.map((s) => (
              <Chip key={s} onClick={() => send(s)}>{s}</Chip>
            ))}
          </div>
        )}

        {loading && (
          <div className="ui-lume-think" role="status" aria-label={`${NAME} is thinking`}>
            <i /><i /><i />
          </div>
        )}
        {error && <div className="ui-lume-note ui-lume-note--error">{error}</div>}
        {capped && (
          <div className="ui-lume-note">
            You've used today's messages with {NAME}. Back tomorrow.
          </div>
        )}
      </div>

      {!capped && <LumeInput chat={chat} onSend={send} isMobile={isMobile} inputRef={inputRef} />}
    </>
  );
}
