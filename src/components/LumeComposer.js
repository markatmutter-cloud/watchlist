import React from "react";
import LumeInput from "./LumeInput";

// LumeComposer — the single chat input on the mobile canvas home. Search is chat-driven
// (you ask Lumé; it engages search), so there is one input, not a Search/Ask split. It is
// the shared LumeInput with the home's own placeholder.
export default function LumeComposer({ chat, onSend, isMobile, placeholder = "Ask Lumé, or search the catalog…" }) {
  return <LumeInput chat={chat} onSend={onSend} isMobile={isMobile} placeholder={placeholder} />;
}
