import React, { useState, useEffect, useCallback } from "react";
import { supabase, useAuth } from "../supabase";
import { SubTabs, Button } from "../ui";

// Settings panel for Lumé's memory (the per-user taste profile). View what it's
// learned, turn it on/off, and reset (forget). Reads the profile directly (RLS
// allows own-row select); writes go through SECURITY DEFINER RPCs (a direct
// authenticated write is rejected on this project regardless of RLS).
const label = {
  fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
  color: "var(--text3)", marginTop: 20, marginBottom: 8,
};

function profileSummary(profile) {
  if (!profile || typeof profile !== "object" || !Object.keys(profile).length) return "";
  if (profile.summary && typeof profile.summary === "string") return profile.summary;
  // Fall back to a compact line from the structured fields.
  const parts = [];
  for (const k of ["brands", "model_lines", "eras", "budget", "likes", "dislikes", "considering", "owns"]) {
    const v = profile[k];
    if (Array.isArray(v) && v.length) parts.push(`${k}: ${v.join(", ")}`);
    else if (typeof v === "string" && v) parts.push(`${k}: ${v}`);
  }
  return parts.join(" · ");
}

export function LumeMemorySettings() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from("ai_user_profile").select("enabled, profile").maybeSingle();
      if (data) { setEnabled(data.enabled !== false); setProfile(data.profile || null); }
      else { setEnabled(true); setProfile(null); }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  if (!user) return null;

  const toggle = async () => {
    const next = !enabled;
    setBusy(true); setStatus("");
    try { await supabase.rpc("set_ai_memory_enabled", { p_enabled: next }); setEnabled(next); }
    catch { setStatus("Couldn't update. Try again."); }
    setBusy(false);
  };
  const reset = async () => {
    setBusy(true); setStatus("");
    try { await supabase.rpc("reset_ai_profile"); setProfile(null); setStatus("Cleared. Lumé starts fresh."); }
    catch { setStatus("Couldn't reset. Try again."); }
    setBusy(false);
  };

  const summary = profileSummary(profile);

  return (
    <div>
      <div style={label}>Lumé memory</div>
      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 10 }}>
        Lumé quietly learns your taste as you chat, so it remembers you across sessions. It's private to you.
      </div>

      <SubTabs block choice ariaLabel="Lumé memory" activeKey={enabled ? "on" : "off"}
        onSelect={(k) => { if (!busy && (k === "on") !== enabled) toggle(); }}
        tabs={[{ key: "on", label: "Remember my taste" }, { key: "off", label: "Off" }]} />

      {loaded && (
        <div style={{ fontSize: 12, color: "var(--text3)", margin: "10px 0", lineHeight: 1.5 }}>
          {summary
            ? <>What it remembers: <span style={{ color: "var(--text2)" }}>{summary.slice(0, 400)}</span></>
            : "Nothing yet. Chat a few messages with Lumé and it'll start learning your taste."}
        </div>
      )}

      <Button link danger onClick={reset} disabled={busy || !summary}>Forget everything</Button>

      {status && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>{status}</div>}
    </div>
  );
}
