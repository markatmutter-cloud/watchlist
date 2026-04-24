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

  const signInWithGoogle = useCallback(() => {
    if (!supabase) return Promise.reject(new Error('Auth not configured'));
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(() => {
    if (!supabase) return Promise.resolve();
    return supabase.auth.signOut();
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
        next[row.listing_id] = {
          id: row.listing_id,
          savedAt:        row.saved_at,
          savedPrice:     row.saved_price,
          savedCurrency:  row.saved_currency,
          savedPriceUSD:  row.saved_price_usd,
          // listing_snapshot is the full listing payload at save time —
          // we spread it so Card can render from the watchlist entry alone.
          ...(row.listing_snapshot || {}),
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

  return { items, editor, setEditor, startAdd, startEdit, cancel, commit, remove };
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
