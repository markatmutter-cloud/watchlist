// Supabase client + auth/data hooks.
//
// All backend-talking code lives here. The rest of the app imports what it
// needs — useAuth(), useWatchlist(user), useHidden(user), useSearches(user) —
// and doesn't touch `supabase` directly. That keeps UI code oblivious to
// whether data lives in Postgres or localStorage.
//
// The publishable key is safe to embed (Row Level Security is what actually
// protects data). We read both URL and key from CRA's env at build time —
// missing values => the client is null and every hook no-ops, so the app
// still runs for anonymous users even without a configured backend.

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect, useCallback } from 'react';
import { canonicalizeBrand } from './utils';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export const isAuthConfigured = !!supabase;


// ── AUTH ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [user, setUser] = useState(null);
  // `ready` flips true once we've checked for an existing session. UI can
  // render a small spinner in the sign-in slot until then so we don't flash
  // "Sign in" for logged-in users returning to the page.
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    // Initial session lookup. supabase-js also inspects the URL hash for OAuth
    // redirect tokens (detectSessionInUrl defaults to true), so this call
    // resolves to the user if they just came back from Google.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setReady(true);
    });

    // Live subscription so sign-in / sign-out elsewhere (another tab, expiry)
    // flow into this hook's state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // Force Google to always show the account picker. Without this,
        // Google silently re-auths anyone who has an active Google SSO
        // session in this browser — sign-in looks like "the page just
        // reloaded". The picker makes the auth step visible and lets
        // users pick a different Google account if they want to.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      // Surface the error so a silent "nothing happens" stops being a
      // mystery. supabase-js otherwise navigates automatically so we
      // never reach the post-nav code.
      console.warn('Sign in error', error);
      alert('Sign in failed: ' + (error.message || 'unknown error'));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut error', e);
    }
    // Belt-and-braces cleanup. Without this, two things can revive the
    // session immediately after "logging out":
    //   1. Supabase stores auth state in localStorage under keys like
    //      sb-<project-ref>-auth-token. If signOut's network call fails
    //      (expired token, offline, rate-limit), those keys aren't cleared.
    //   2. After OAuth, tokens sit in the URL hash. If we don't scrub it,
    //      the library re-parses the hash on next page load and
    //      re-establishes the session.
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('sb-') || k.toLowerCase().includes('supabase')) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    // Reload so every hook re-initialises with a clean, unauthenticated state.
    window.location.reload();
  }, []);

  return { user, ready, signInWithGoogle, signOut };
}


// ── WATCHLIST ────────────────────────────────────────────────────────────────
// Returns an object keyed by listing_id (matches the pre-Supabase shape) so
// the rest of the app doesn't need to change: `!!watchlist[item.id]` etc.

export function useWatchlist(user) {
  const [items, setItems] = useState({});

  useEffect(() => {
    if (!user || !supabase) { setItems({}); return; }
    let cancelled = false;
    supabase.from('watchlist_items').select('*').then(({ data, error }) => {
      if (cancelled) return;
      if (error) { console.warn('watchlist load failed', error); return; }
      const next = {};
      for (const row of data || []) {
        const snap = row.listing_snapshot || {};
        next[row.listing_id] = {
          id: row.listing_id,
          savedAt:        row.saved_at,
          savedPrice:     row.saved_price,
          savedCurrency:  row.saved_currency,
          savedPriceUSD:  row.saved_price_usd,
          // listing_snapshot is the full listing payload at save time —
          // we spread it so Card can render from the watchlist entry alone.
          ...snap,
          // Snapshots predate brand-alias normalization in merge.py —
          // a listing hearted as "Jaeger LeCoultre" / "LeCoultre" /
          // etc. lives in Supabase with that frozen string. Canonicalize
          // on read so chips and group-by buckets collapse correctly.
          // Idempotent on already-canonical brands.
          brand: canonicalizeBrand(snap.brand),
          // cached_img_url is populated by cache_watchlist_images.mjs in
          // the cron — when present, it points at a Vercel Blob copy
          // that survives the dealer deleting their original. Prefer
          // it over the dealer URL when rendering. Empty string means
          // "processed, no image available" (skip).
          img: row.cached_img_url || snap.img || "",
        };
      }
      setItems(next);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const toggle = useCallback(async (item) => {
    if (!user || !supabase) return;
    if (items[item.id]) {
      // Optimistic remove → then reconcile with DB. If the DB call fails we
      // currently just log; the local state is still correct for the user.
      setItems(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      const { error } = await supabase.from('watchlist_items').delete()
        .match({ user_id: user.id, listing_id: item.id });
      if (error) console.warn('watchlist remove', error);
    } else {
      const savedAt = new Date().toISOString();
      const saved = {
        ...item,
        savedAt,
        savedPrice:     item.price,
        savedCurrency:  item.currency || 'USD',
        savedPriceUSD:  item.priceUSD,
      };
      setItems(prev => ({ ...prev, [item.id]: saved }));
      const { error } = await supabase.from('watchlist_items').insert({
        user_id:          user.id,
        listing_id:       item.id,
        saved_at:         savedAt,
        saved_price:      item.price,
        saved_currency:   item.currency || 'USD',
        saved_price_usd:  item.priceUSD,
        listing_snapshot: item,
      });
      if (error) console.warn('watchlist add', error);
    }
  }, [user, items]);

  return { items, toggle };
}


// ── HIDDEN ───────────────────────────────────────────────────────────────────
// Shape matches old localStorage version: object keyed by listing_id with
// ISO timestamps as values. Code that checks `!!hidden[item.id]` keeps working.

export function useHidden(user) {
  const [items, setItems] = useState({});

  useEffect(() => {
    if (!user || !supabase) { setItems({}); return; }
    let cancelled = false;
    supabase.from('hidden_listings').select('*').then(({ data, error }) => {
      if (cancelled) return;
      if (error) { console.warn('hidden load failed', error); return; }
      const next = {};
      for (const row of data || []) next[row.listing_id] = row.hidden_at;
      setItems(next);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const toggle = useCallback(async (item) => {
    if (!user || !supabase) return;
    if (items[item.id]) {
      setItems(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      const { error } = await supabase.from('hidden_listings').delete()
        .match({ user_id: user.id, listing_id: item.id });
      if (error) console.warn('hidden remove', error);
    } else {
      const hiddenAt = new Date().toISOString();
      setItems(prev => ({ ...prev, [item.id]: hiddenAt }));
      const { error } = await supabase.from('hidden_listings').insert({
        user_id: user.id, listing_id: item.id, hidden_at: hiddenAt,
      });
      if (error) console.warn('hidden add', error);
    }
  }, [user, items]);

  return { items, toggle };
}


// ── SAVED SEARCHES ──────────────────────────────────────────────────────────
// Per-user, editable. Returns state + a built-in editor state to match the
// pattern we had before Supabase — minimizes App.js churn on re-enabling.

export function useSearches(user) {
  const [items, setItems]   = useState([]);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    if (!user || !supabase) { setItems([]); return; }
    let cancelled = false;
    supabase.from('saved_searches').select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.warn('searches load failed', error); return; }
        setItems((data || []).map(r => ({ id: r.id, label: r.label, query: r.query })));
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const startAdd  = useCallback(() => setEditor({ id: 'new', label: '', query: '' }), []);
  const startEdit = useCallback((s)  => setEditor({ ...s }), []);
  const cancel    = useCallback(()   => setEditor(null), []);

  const commit = useCallback(async () => {
    if (!user || !supabase || !editor) return;
    const label = (editor.label || '').trim();
    const query = (editor.query || '').trim();
    if (!label || !query) { setEditor(null); return; }

    if (editor.id === 'new') {
      const { data, error } = await supabase.from('saved_searches')
        .insert({ user_id: user.id, label, query })
        .select().single();
      if (!error && data) {
        setItems(prev => [...prev, { id: data.id, label: data.label, query: data.query }]);
      } else if (error) console.warn('search add', error);
    } else {
      const { error } = await supabase.from('saved_searches')
        .update({ label, query }).eq('id', editor.id);
      if (!error) {
        setItems(prev => prev.map(s => s.id === editor.id ? { ...s, label, query } : s));
      } else console.warn('search update', error);
    }
    setEditor(null);
  }, [user, editor]);

  const remove = useCallback(async (id) => {
    if (!user || !supabase) return;
    setItems(prev => prev.filter(s => s.id !== id));
    if (editor && editor.id === id) setEditor(null);
    const { error } = await supabase.from('saved_searches').delete().eq('id', id);
    if (error) console.warn('search remove', error);
  }, [user, editor]);

  // Direct insert without going through the editor flow — useful for the
  // "save current search as a favorite" heart button in the search bar.
  // Returns { error: null } on success, { error: string } otherwise.
  const quickAdd = useCallback(async (label, query) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const cleanLabel = (label || '').trim();
    const cleanQuery = (query || '').trim();
    if (!cleanLabel || !cleanQuery) return { error: 'label and query required' };
    // Reject exact duplicates so the heart can't accidentally spawn dozens
    // of identical entries on repeated taps.
    if (items.some(s => s.query.toLowerCase() === cleanQuery.toLowerCase())) {
      return { error: 'already saved' };
    }
    const { data, error } = await supabase.from('saved_searches')
      .insert({ user_id: user.id, label: cleanLabel, query: cleanQuery })
      .select().single();
    if (error) return { error: error.message };
    setItems(prev => [...prev, { id: data.id, label: data.label, query: data.query }]);
    return { error: null };
  }, [user, items]);

  return { items, editor, setEditor, startAdd, startEdit, cancel, commit, remove, quickAdd };
}


// ── COLLECTIONS ─────────────────────────────────────────────────────────────
// User-created collections beyond the default "Watchlist" — "For Wife",
// "Reference comps - 5512", etc. — plus the auto "Shared with me"
// inbox.
//
// Approach A (minimal): the user's default Watchlist collection is
// implicit and continues to be backed by the existing watchlist_items
// table (see useWatchlist above). This hook ONLY manages additional
// collections + items. The asymmetry is intentional — keeps the
// existing heart-on-card flow unchanged and avoids a full migration of
// historic watchlist_items rows.
//
// Schema lives in supabase/schema/2026-05-01_collections.sql. Two
// tables: `collections` (one row per user-created or shared-inbox
// collection; nothing for the default Watchlist) and
// `collection_items` (denormalized listing snapshot per collection
// membership).
//
// The hook returns:
//   collections — array of { id, name, type, isSharedInbox, ... }
//   itemsByCollection — { [collection_id]: array of items }
//   Plus mutators: createCollection, renameCollection, deleteCollection,
//   addItemToCollection, removeItemFromCollection, ensureSharedInbox,
//   addToSharedInbox.
//
// All mutators are no-ops when signed out — they return { error } so
// the caller can surface a sign-in prompt if appropriate.

export function useCollections(user) {
  const [collections, setCollections]           = useState([]);
  const [itemsByCollection, setItemsByCollection] = useState({});

  // Initial fetch — collections + their items in two queries.
  useEffect(() => {
    if (!user || !supabase) {
      setCollections([]);
      setItemsByCollection({});
      return;
    }
    let cancelled = false;
    (async () => {
      const [colRes, itemRes] = await Promise.all([
        supabase.from('collections').select('*').order('created_at', { ascending: true }),
        // RLS filters items to ones in collections the user owns, so
        // we don't need to join here — the filter is implicit.
        supabase.from('collection_items').select('*').order('added_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (colRes.error)  { console.warn('collections load failed', colRes.error); return; }
      if (itemRes.error) { console.warn('collection_items load failed', itemRes.error); return; }
      const cols = (colRes.data || []).map(r => ({
        id:                  r.id,
        name:                r.name,
        description:         r.description,
        type:                r.type,
        isSharedInbox:       r.is_shared_inbox,
        // Challenge-specific fields (null/undefined for non-challenges).
        // 2026-05-03_challenges.sql adds these columns; pre-migration
        // collections come back with `undefined` and the UI code below
        // treats them as "not a challenge." Keep camelCase in the
        // app-facing shape, snake_case at the DB boundary.
        targetCount:         r.target_count,
        budget:              r.budget,
        descriptionLong:     r.description_long,
        state:               r.state || 'complete',
        parentChallengeId:   r.parent_challenge_id,
        createdAt:           r.created_at,
        updatedAt:           r.updated_at,
      }));
      const grouped = {};
      for (const row of (itemRes.data || [])) {
        const snap = row.listing_snapshot || {};
        const item = {
          rowId:           row.id,                 // collection_items.id (for delete)
          id:              row.listing_id,
          savedPrice:      row.saved_price,
          savedCurrency:   row.saved_currency,
          savedPriceUSD:   row.saved_price_usd,
          sourceOfEntry:   row.source_of_entry,
          sharedByHandle:  row.shared_by_handle,
          savedAt:         row.added_at,
          // Challenge-specific item fields
          isPick:          !!row.is_pick,
          reasoning:       row.reasoning || '',
          ...snap,
        };
        (grouped[row.collection_id] ||= []).push(item);
      }
      setCollections(cols);
      setItemsByCollection(grouped);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Collection CRUD ──────────────────────────────────────────
  const createCollection = useCallback(async (name, opts = {}) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const cleanName = (name || '').trim();
    if (!cleanName) return { error: 'name required' };
    const payload = {
      user_id:          user.id,
      name:             cleanName,
      description:      opts.description || null,
      type:             opts.type || 'free-form',
      is_shared_inbox:  !!opts.isSharedInbox,
    };
    const { data, error } = await supabase.from('collections').insert(payload).select().single();
    if (error) return { error: error.message };
    setCollections(prev => [...prev, {
      id: data.id, name: data.name, description: data.description,
      type: data.type, isSharedInbox: data.is_shared_inbox,
      createdAt: data.created_at, updatedAt: data.updated_at,
    }]);
    return { error: null, id: data.id };
  }, [user]);

  const renameCollection = useCallback(async (id, name) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const cleanName = (name || '').trim();
    if (!cleanName) return { error: 'name required' };
    const { error } = await supabase.from('collections')
      .update({ name: cleanName, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    setCollections(prev => prev.map(c => c.id === id ? { ...c, name: cleanName } : c));
    return { error: null };
  }, [user]);

  const deleteCollection = useCallback(async (id) => {
    if (!user || !supabase) return { error: 'not signed in' };
    // Don't let the user delete the shared-inbox; spec says it's
    // perma. Clearing items inside it is allowed.
    const target = collections.find(c => c.id === id);
    if (target?.isSharedInbox) return { error: 'cannot delete shared inbox' };
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) return { error: error.message };
    setCollections(prev => prev.filter(c => c.id !== id));
    setItemsByCollection(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return { error: null };
  }, [user, collections]);

  // ── Item CRUD ────────────────────────────────────────────────
  const addItemToCollection = useCallback(async (collectionId, listing, opts = {}) => {
    if (!user || !supabase) return { error: 'not signed in' };
    if (!collectionId || !listing?.id) return { error: 'collection and listing required' };
    const payload = {
      collection_id:    collectionId,
      listing_id:       listing.id,
      saved_price:      listing.price ?? null,
      saved_currency:   listing.currency || 'USD',
      saved_price_usd:  listing.priceUSD ?? null,
      listing_snapshot: listing,
      source_of_entry:  opts.sourceOfEntry || 'manual',
      shared_by_handle: opts.sharedByHandle || null,
    };
    const { data, error } = await supabase.from('collection_items')
      .insert(payload)
      .select().single();
    // 23505 is Postgres' unique_violation — same listing already in
    // collection. Spec calls for idempotent re-shares; surface as
    // success rather than error so callers don't have to special-case.
    if (error && error.code !== '23505') return { error: error.message };
    if (data) {
      setItemsByCollection(prev => ({
        ...prev,
        [collectionId]: [
          {
            rowId:           data.id,
            id:              data.listing_id,
            savedPrice:      data.saved_price,
            savedCurrency:   data.saved_currency,
            savedPriceUSD:   data.saved_price_usd,
            sourceOfEntry:   data.source_of_entry,
            sharedByHandle:  data.shared_by_handle,
            savedAt:         data.added_at,
            ...listing,
          },
          ...(prev[collectionId] || []),
        ],
      }));
    }
    return { error: null };
  }, [user]);

  const removeItemFromCollection = useCallback(async (collectionId, listingId) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const { error } = await supabase.from('collection_items')
      .delete()
      .match({ collection_id: collectionId, listing_id: listingId });
    if (error) return { error: error.message };
    setItemsByCollection(prev => ({
      ...prev,
      [collectionId]: (prev[collectionId] || []).filter(it => it.id !== listingId),
    }));
    return { error: null };
  }, [user]);

  // ── Shared-inbox helpers ─────────────────────────────────────
  // The Shared-with-me collection is created lazily on first received
  // share. ensureSharedInbox returns its id (creating it if missing).
  // Concurrent calls are safe — the partial unique index on
  // is_shared_inbox=true serializes inserts, and we re-fetch after a
  // 23505 conflict.
  const ensureSharedInbox = useCallback(async () => {
    if (!user || !supabase) return { error: 'not signed in' };
    const existing = collections.find(c => c.isSharedInbox);
    if (existing) return { error: null, id: existing.id };
    const { data, error } = await supabase.from('collections').insert({
      user_id:          user.id,
      name:             'Shared with me',
      type:             'shared-inbox',
      is_shared_inbox:  true,
    }).select().single();
    if (error && error.code === '23505') {
      // Race — another tab/window created it. Re-fetch.
      const { data: row } = await supabase.from('collections')
        .select('*').eq('user_id', user.id).eq('is_shared_inbox', true).single();
      if (row) {
        setCollections(prev => prev.find(c => c.id === row.id) ? prev : [...prev, {
          id: row.id, name: row.name, description: row.description,
          type: row.type, isSharedInbox: row.is_shared_inbox,
          createdAt: row.created_at, updatedAt: row.updated_at,
        }]);
        return { error: null, id: row.id };
      }
    }
    if (error) return { error: error.message };
    setCollections(prev => [...prev, {
      id: data.id, name: data.name, description: data.description,
      type: data.type, isSharedInbox: data.is_shared_inbox,
      createdAt: data.created_at, updatedAt: data.updated_at,
    }]);
    return { error: null, id: data.id };
  }, [user, collections]);

  // Convenience for the share-receive flow — finds-or-creates the
  // Shared-with-me collection, then adds the listing with
  // source_of_entry='shared_with_me'. Idempotent on re-shares.
  const addToSharedInbox = useCallback(async (listing, opts = {}) => {
    const ensured = await ensureSharedInbox();
    if (ensured.error) return ensured;
    return addItemToCollection(ensured.id, listing, {
      sourceOfEntry: 'shared_with_me',
      sharedByHandle: opts.sharedByHandle || null,
    });
  }, [ensureSharedInbox, addItemToCollection]);

  // ── Challenge mutators (Build-a-collection v1) ───────────────
  // Challenges are collections with type='challenge'. They use the
  // same items table as other collections, but the items have an
  // is_pick boolean distinguishing the shortlist from the final picks
  // and a `reasoning` text per pick. Drafts (state='draft') aren't
  // shareable; completing flips state to 'complete'.
  const createChallenge = useCallback(async ({ name, targetCount, budget, descriptionLong, parentChallengeId } = {}) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const cleanName = (name || '').trim() || `${targetCount || 3} watches for $${Math.round((budget || 50000) / 1000)}k`;
    const payload = {
      user_id:               user.id,
      name:                  cleanName,
      type:                  'challenge',
      state:                 'draft',
      target_count:          targetCount || null,
      budget:                budget || null,
      description_long:      descriptionLong || null,
      parent_challenge_id:   parentChallengeId || null,
    };
    const { data, error } = await supabase.from('collections').insert(payload).select().single();
    if (error) return { error: error.message };
    setCollections(prev => [...prev, {
      id: data.id, name: data.name, description: data.description,
      type: data.type, isSharedInbox: false,
      targetCount: data.target_count, budget: data.budget,
      descriptionLong: data.description_long, state: data.state,
      parentChallengeId: data.parent_challenge_id,
      createdAt: data.created_at, updatedAt: data.updated_at,
    }]);
    return { error: null, id: data.id };
  }, [user]);

  const updateChallenge = useCallback(async (id, patch) => {
    if (!user || !supabase) return { error: 'not signed in' };
    // Map camelCase patch keys to the snake_case DB columns.
    const dbPatch = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined)              dbPatch.name = patch.name;
    if (patch.targetCount !== undefined)       dbPatch.target_count = patch.targetCount;
    if (patch.budget !== undefined)            dbPatch.budget = patch.budget;
    if (patch.descriptionLong !== undefined)   dbPatch.description_long = patch.descriptionLong;
    if (patch.state !== undefined)             dbPatch.state = patch.state;
    const { error } = await supabase.from('collections').update(dbPatch).eq('id', id);
    if (error) return { error: error.message };
    setCollections(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    return { error: null };
  }, [user]);

  // Add a listing to a challenge's shortlist (is_pick=false). Same
  // payload shape as addItemToCollection but always shortlist-tier.
  const addToShortlist = useCallback(async (challengeId, listing) => {
    if (!user || !supabase) return { error: 'not signed in' };
    if (!challengeId || !listing?.id) return { error: 'challenge and listing required' };
    const payload = {
      collection_id:    challengeId,
      listing_id:       listing.id,
      saved_price:      null,         // shortlist items don't snapshot price
      saved_currency:   null,
      saved_price_usd:  null,
      listing_snapshot: listing,
      source_of_entry:  'manual',
      is_pick:          false,
      reasoning:        null,
    };
    const { data, error } = await supabase.from('collection_items')
      .insert(payload).select().single();
    if (error && error.code !== '23505') return { error: error.message };
    if (data) {
      setItemsByCollection(prev => ({
        ...prev,
        [challengeId]: [
          {
            rowId: data.id, id: data.listing_id,
            savedPrice: null, savedCurrency: null, savedPriceUSD: null,
            sourceOfEntry: data.source_of_entry, savedAt: data.added_at,
            isPick: false, reasoning: '',
            ...listing,
          },
          ...(prev[challengeId] || []),
        ],
      }));
    }
    return { error: null };
  }, [user]);

  // Promote a shortlist item to a pick (is_pick=true) — snapshots the
  // current listing price into saved_price/_currency/_price_usd so the
  // challenge total is immutable once shared. Demoting (isPick=false)
  // clears the snapshot so the next promotion captures fresh prices.
  const togglePickStatus = useCallback(async (rowId, isPick, listing) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const dbPatch = { is_pick: !!isPick };
    if (isPick && listing) {
      dbPatch.saved_price     = listing.price ?? null;
      dbPatch.saved_currency  = listing.currency || 'USD';
      dbPatch.saved_price_usd = listing.priceUSD ?? listing.price ?? null;
    } else if (!isPick) {
      dbPatch.saved_price     = null;
      dbPatch.saved_currency  = null;
      dbPatch.saved_price_usd = null;
    }
    const { error } = await supabase.from('collection_items').update(dbPatch).eq('id', rowId);
    if (error) return { error: error.message };
    setItemsByCollection(prev => {
      const next = { ...prev };
      for (const [colId, items] of Object.entries(prev)) {
        if (items.some(it => it.rowId === rowId)) {
          next[colId] = items.map(it => it.rowId === rowId ? {
            ...it, isPick: !!isPick,
            savedPrice: dbPatch.saved_price,
            savedCurrency: dbPatch.saved_currency,
            savedPriceUSD: dbPatch.saved_price_usd,
          } : it);
        }
      }
      return next;
    });
    return { error: null };
  }, [user]);

  // Update the per-pick reasoning text. Debounce at the call site if
  // needed; this hook just writes through.
  const updateReasoning = useCallback(async (rowId, reasoning) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const { error } = await supabase.from('collection_items')
      .update({ reasoning }).eq('id', rowId);
    if (error) return { error: error.message };
    setItemsByCollection(prev => {
      const next = { ...prev };
      for (const [colId, items] of Object.entries(prev)) {
        if (items.some(it => it.rowId === rowId)) {
          next[colId] = items.map(it => it.rowId === rowId ? { ...it, reasoning } : it);
        }
      }
      return next;
    });
    return { error: null };
  }, [user]);

  return {
    collections,
    itemsByCollection,
    createCollection,
    renameCollection,
    deleteCollection,
    addItemToCollection,
    removeItemFromCollection,
    ensureSharedInbox,
    addToSharedInbox,
    // Challenge-specific:
    createChallenge,
    updateChallenge,
    addToShortlist,
    togglePickStatus,
    updateReasoning,
  };
}


// ── TRACKED AUCTION LOTS ────────────────────────────────────────────────────
// Per-user. Each row is just a (user_id, lot_url) pairing — the lot's
// scraped data (image, title, estimate, current bid, sold price, auction
// end time) lives in public/tracked_lots.json keyed by URL, refreshed by
// the cron pipeline. The frontend joins the two.

export function useTrackedLots(user) {
  const [urls, setUrls] = useState([]);
  // url → added_at ISO string. Used by App.js to populate `savedAt`
  // when projecting tracked lots into the unified Watchlist render.
  const [addedAt, setAddedAt] = useState({});

  useEffect(() => {
    if (!user || !supabase) { setUrls([]); setAddedAt({}); return; }
    let cancelled = false;
    supabase.from('tracked_lots').select('lot_url, added_at')
      .order('added_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.warn('tracked lots load failed', error); return; }
        const rows = data || [];
        setUrls(rows.map(r => r.lot_url));
        setAddedAt(Object.fromEntries(rows.map(r => [r.lot_url, r.added_at])));
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const add = useCallback(async (rawUrl) => {
    if (!user || !supabase) return { error: 'not signed in' };
    const url = (rawUrl || '').trim();
    if (!url) return { error: 'empty URL' };
    // 2026-05-04: narrowed to eBay-only. Auction-house lots
    // (Antiquorum / Christie's / Sotheby's / Phillips) are now
    // discovered via auction_lots_scraper.py's daily comprehensive
    // sweep and saved via heart-on-lot, not via this modal. The
    // Antiquorum / Christie's / Sotheby's / Monaco Legend / Phillips
    // patterns are intentionally retired from the validator — pasting
    // one of those URLs returns a clear error directing the user to
    // heart the lot from the unified feed instead.
    const supported = [
      // eBay item URLs come in several flavors: canonical
      // /itm/<id>, with title slug /itm/<slug>/<id>, regional TLDs
      // (ebay.co.uk, ebay.de, ebay.fr, ...) and short share URLs
      // (ebay.us / ebay.gg / ebay.to that redirect to /itm).
      /^https?:\/\/(?:www\.)?ebay\.(?:com|co\.uk|de|fr|it|es|nl|at|ch|ca|com\.au)\/itm\/(?:[^/]+\/)?\d{6,}/i,
      /^https?:\/\/(?:www\.)?ebay\.(?:us|gg|to)\/[a-z]\/[A-Za-z0-9]+/i,
    ];
    if (!supported.some(re => re.test(url))) {
      return { error: 'Only eBay item URLs are supported here. For auction-house lots (Antiquorum / Christie\'s / Sotheby\'s / Phillips) heart them from the main feed — they\'re scraped automatically.' };
    }
    if (urls.includes(url)) return { error: 'Already tracking this lot.' };
    const ts = new Date().toISOString();
    setUrls(prev => [url, ...prev]);
    setAddedAt(prev => ({ ...prev, [url]: ts }));
    const { error } = await supabase.from('tracked_lots').insert({
      user_id: user.id,
      lot_url: url,
      added_at: ts,
    });
    if (error) {
      // Roll back optimistic add on failure.
      setUrls(prev => prev.filter(u => u !== url));
      setAddedAt(prev => { const n = { ...prev }; delete n[url]; return n; });
      console.warn('tracked lot add', error);
      return { error: error.message };
    }
    return { error: null };
  }, [user, urls]);

  const remove = useCallback(async (url) => {
    if (!user || !supabase) return;
    setUrls(prev => prev.filter(u => u !== url));
    setAddedAt(prev => { const n = { ...prev }; delete n[url]; return n; });
    const { error } = await supabase.from('tracked_lots').delete()
      .match({ user_id: user.id, lot_url: url });
    if (error) console.warn('tracked lot remove', error);
  }, [user]);

  return { urls, add, remove, addedAt };
}


// ── USER SETTINGS ───────────────────────────────────────────────────────────
// Cross-device user-level preferences (vs theme/columns which are
// per-device + localStorage). v1 holds primary_currency only; future
// fields land here too so we don't proliferate one-off tables.
//
// Lazy-create: a missing row is fine. The hook returns the default
// ('USD') until the user changes something, at which point we upsert.
// Optimistic UI — local state flips immediately, DB write logs on
// failure but doesn't block the change.

const ALLOWED_CURRENCIES = ['USD', 'GBP', 'EUR'];
const DEFAULT_CURRENCY = 'USD';

export function useUserSettings(user) {
  const [primaryCurrency, setPrimaryCurrencyLocal] = useState(DEFAULT_CURRENCY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || !supabase) {
      setPrimaryCurrencyLocal(DEFAULT_CURRENCY);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    supabase.from('user_settings')
      .select('primary_currency')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('user_settings load failed', error);
        const v = data?.primary_currency;
        setPrimaryCurrencyLocal(
          ALLOWED_CURRENCIES.includes(v) ? v : DEFAULT_CURRENCY
        );
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const setPrimaryCurrency = useCallback(async (next) => {
    if (!ALLOWED_CURRENCIES.includes(next)) return { error: 'invalid currency' };
    setPrimaryCurrencyLocal(next);
    if (!user || !supabase) return { error: null };
    const { error } = await supabase.from('user_settings').upsert({
      user_id:          user.id,
      primary_currency: next,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) console.warn('user_settings save failed', error);
    return { error: error?.message || null };
  }, [user]);

  return { primaryCurrency, setPrimaryCurrency, loaded };
}


// ── IMPORT FROM LOCALSTORAGE ────────────────────────────────────────────────
// One-shot helper: bulk-upload whatever's in the user's browser localStorage
// (watchlist + hidden) into their Supabase account. `ignoreDuplicates` means
// re-running is safe — existing rows are kept untouched, new ones added.

export async function importLocalData(user, { watchlist = {}, hidden = {} }) {
  if (!user || !supabase) return { imported: 0, error: 'not signed in' };

  let imported = 0;

  const wlRows = Object.values(watchlist).map(w => ({
    user_id:          user.id,
    listing_id:       w.id,
    saved_at:         w.savedAt || new Date().toISOString(),
    saved_price:      w.savedPrice ?? w.price,
    saved_currency:   w.savedCurrency || w.currency || 'USD',
    saved_price_usd:  w.savedPriceUSD ?? w.priceUSD,
    listing_snapshot: w,
  })).filter(r => r.listing_id);

  if (wlRows.length) {
    const { error } = await supabase.from('watchlist_items')
      .upsert(wlRows, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
    if (error) return { imported, error: error.message };
    imported += wlRows.length;
  }

  const hiddenRows = Object.entries(hidden).map(([listing_id, hidden_at]) => ({
    user_id: user.id,
    listing_id,
    hidden_at: hidden_at || new Date().toISOString(),
  })).filter(r => r.listing_id);

  if (hiddenRows.length) {
    const { error } = await supabase.from('hidden_listings')
      .upsert(hiddenRows, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
    if (error) return { imported, error: error.message };
    imported += hiddenRows.length;
  }

  return { imported, error: null };
}
