// Device-native dictation engine (the Web Speech API uses the OS/browser engine).
// null where unsupported, so the mic button is simply not rendered. Its own module so the
// composer and the conversation can both read it without importing each other.
export const SpeechRec =
  typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
