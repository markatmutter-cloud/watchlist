import React, { useEffect, useRef } from "react";
import { SpeechRec } from "./lumeSpeech";

// LumeInput — the one Lumé composer: a rounded field with dictation and Send seated inside
// it (src/ui/ui.css `.ui-lume-*`). The conversation and the mobile-home composer both
// render this, so the two cannot drift. State (draft, mic) lives in useLumeChat.
const MicIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);
const SendIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
  </svg>
);

export default function LumeInput({ chat, onSend, isMobile, placeholder = "Ask about a watch…", inputRef }) {
  const { draft, setDraft, loading, toggleMic, listening } = chat;
  const own = useRef(null);
  const ref = inputRef || own;

  // Grow with the draft to about five lines, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft, ref]);

  const submit = () => {
    const text = (draft || "").trim();
    if (!text || loading) return;
    onSend(text);
  };
  const disabled = loading || !((draft || "").trim());

  return (
    <form className={`ui-lume-compose${isMobile ? " ui-lume-compose--sheet" : ""}`}
          onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="ui-lume-field">
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          disabled={loading}
          rows={1}
        />
        {SpeechRec && (
          <button type="button" className={`ui-lume-ibtn ui-lume-mic${listening ? " is-on" : ""}`}
                  onClick={toggleMic} aria-label={listening ? "Stop dictation" : "Dictate"} title="Dictate">
            <MicIcon />
          </button>
        )}
        <button type="submit" className="ui-lume-ibtn ui-lume-send" disabled={disabled} title="Send">
          <SendIcon />
          <span className="ui-sr">Send</span>
        </button>
      </div>
    </form>
  );
}
