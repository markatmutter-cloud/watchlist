import { useState, useEffect } from "react";

// eBay source-search config + live counts. Surfaces the contents of
// data/ebay_searches.json in the Searches sub-tab so Mark can see what
// the scraper is currently pulling. Read-only here — edits go through
// the GitHub editor (button in the section header). When/if Mark wants
// in-app CRUD, migrate the JSON to a Supabase table and the rest of
// this hook stays the same.
//
// Counts are computed from data/ebay.csv: each row's last column is
// _search_label, identical to the search's label in the JSON config.
// We split on the LAST comma rather than running a full CSV parser —
// labels are Mark-controlled and don't contain commas, while titles
// (column 1) often do, so naive split-by-comma would mis-attribute.

const REPO = "markatmutter-cloud/watchlist";
const SEARCHES_URL = `https://raw.githubusercontent.com/${REPO}/main/data/ebay_searches.json`;
const CSV_URL      = `https://raw.githubusercontent.com/${REPO}/main/data/ebay.csv`;
// GitHub's in-browser editor — the /edit/ URL drops the user straight
// into the file with a commit-on-save flow. Cleaner than github.dev for
// a one-file edit.
export const EBAY_SEARCHES_EDIT_URL = `https://github.com/${REPO}/edit/main/data/ebay_searches.json`;

function countLabelsInCsv(text) {
  // Skip header (line 0). For each remaining non-empty line, take
  // everything after the LAST comma — that's the _search_label.
  const counts = new Map();
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lastComma = line.lastIndexOf(",");
    if (lastComma === -1) continue;
    const label = line.slice(lastComma + 1).trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return counts;
}

function formatCountry(country) {
  // country can be a single ISO-2 string ("US"), an array
  // (["DE","IT","FR",...]), or undefined.
  if (!country) return "any";
  if (Array.isArray(country)) {
    if (country.length === 0) return "any";
    if (country.length <= 3) return country.join(" / ");
    return `${country.length}-country (EU)`;
  }
  return country;
}

export function useEBaySearches() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [searchesRes, csvRes] = await Promise.all([
          fetch(SEARCHES_URL),
          fetch(CSV_URL),
        ]);
        if (!searchesRes.ok) throw new Error(`searches: ${searchesRes.status}`);
        // CSV may legitimately 404 if the scraper has never run — treat
        // as empty rather than failing the whole hook.
        const csvText = csvRes.ok ? await csvRes.text() : "";
        const config  = await searchesRes.json();
        const counts  = countLabelsInCsv(csvText);

        // Filter out commented-out entries (those carrying _note are
        // documentation placeholders in the JSON — see the example
        // seller entry at the bottom of ebay_searches.json).
        const live = config.filter(s => !s._note);
        const rows = live.map(s => ({
          label:   s.label,
          query:   s.query || "",
          seller:  s.seller || null,
          country: formatCountry(s.country),
          count:   counts.get(s.label) || 0,
          // Direct link to the same search on eBay's web UI. Country
          // filtering on the public site is fiddly per marketplace —
          // skip it for now; the count column already reflects the
          // configured country filter via the API.
          ebayUrl: s.query
            ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(s.query)}`
            : (s.seller
                ? `https://www.ebay.com/usr/${encodeURIComponent(s.seller)}`
                : null),
        }));

        if (!cancelled) {
          setSearches(rows);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || String(e));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { searches, loading, error };
}
