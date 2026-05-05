import { useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";

// Demand-side telemetry (Epic 8 — Site analytics, User stats half).
// Writes to public.listing_events. Anonymous-friendly — every browser
// is given a stable UUID in localStorage so first-time visitors are
// counted before they sign in. Reads are admin-only via RLS, set up
// in supabase/schema/2026-05-05_listing_events.sql.
//
// Two surfaces:
//   recordEvent(eventType, item) — fire any of the engagement events
//     (click / save / hide / list_add / share). View events also flow
//     through here, but the typical caller is observeCard below.
//   observeCard(node, item) — register a Card's DOM node with the
//     shared IntersectionObserver; the observer fires `view` once
//     when the card crosses 50% visibility, then unobserves itself.
//
// View events are deduped per page-load via a module-scoped Set so a
// card that scrolls in and out of view doesn't fire twice. Refresh
// resets the dedup; that's deliberate — a "session view" is the unit.

const ANON_ID_KEY = "dial_watch_anon_id";

// Per-page-load dedup of view events. Lives at module scope so it
// survives re-mounts of the hook (e.g. user signs in mid-session and
// useEventTelemetry's recordEvent identity changes).
const VIEWED_THIS_SESSION = new Set();

function getAnonId() {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      // crypto.randomUUID is available in all modern browsers (incl.
      // iOS 15.4+, which is the iOS PWA install floor for this site).
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function useEventTelemetry(user) {
  const observerRef = useRef(null);
  // WeakMap so disposed nodes don't pin items in memory after unmount.
  const itemByNodeRef = useRef(new WeakMap());

  const recordEvent = useCallback((eventType, item) => {
    if (!supabase || !item || !item.id) return;
    if (eventType === "view") {
      if (VIEWED_THIS_SESSION.has(item.id)) return;
      VIEWED_THIS_SESSION.add(item.id);
    }
    const payload = {
      listing_id: item.id,
      event_type: eventType,
      source: item.source || null,
      anon_session_id: getAnonId(),
      user_id: user ? user.id : null,
    };
    // Fire-and-forget. Telemetry failures must never bubble up to the
    // user experience, so we don't await and we silently swallow
    // errors. On a view-event failure we roll back the dedup so a
    // transient blip doesn't permanently silence a popular listing.
    supabase
      .from("listing_events")
      .insert(payload)
      .then(({ error }) => {
        if (error && eventType === "view") VIEWED_THIS_SESSION.delete(item.id);
      });
  }, [user]);

  // Single shared IntersectionObserver per consumer. Card refs register
  // themselves via observeCard; we keep the (node → item) mapping in a
  // WeakMap so React unmounts naturally clean it up.
  useEffect(() => {
    if (!supabase || typeof IntersectionObserver === "undefined") return undefined;
    const map = itemByNodeRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const item = map.get(e.target);
          if (!item) continue;
          recordEvent("view", item);
          // Unobserve once viewed — same session won't fire again
          // anyway thanks to VIEWED_THIS_SESSION, but unobserving keeps
          // the observer's tracked-node count bounded.
          obs.unobserve(e.target);
        }
      },
      { threshold: 0.5 },
    );
    observerRef.current = obs;
    return () => {
      obs.disconnect();
      observerRef.current = null;
    };
  }, [recordEvent]);

  const observeCard = useCallback((node, item) => {
    if (!observerRef.current || !node || !item || !item.id) return undefined;
    itemByNodeRef.current.set(node, item);
    observerRef.current.observe(node);
    return () => {
      try {
        observerRef.current?.unobserve(node);
        itemByNodeRef.current.delete(node);
      } catch {
        // Disposed observer — fine.
      }
    };
  }, []);

  return { recordEvent, observeCard };
}
