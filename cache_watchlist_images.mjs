/**
 * Watchlist + tracked-lot image caching.
 *
 * Two passes both writing to Vercel Blob so dealer / auction-house
 * URLs going stale doesn't kill our images:
 *
 * 1. **Hearted dealer items** (watchlist_items table). For every row
 *    without a cached_img_url, fetch the dealer image (with proper
 *    Referer for hot-link-protected hosts), upload to Blob at
 *    `watchlist/<listing_id>.<ext>`, write the URL back to Supabase.
 *
 * 2. **Tracked URLs** (tracked_lots Supabase table — auction-house
 *    lots, eBay items, future marketplace URLs). Source data lives
 *    in public/tracked_lots.json (refreshed by auctionlots_scraper.py
 *    just before this script runs). For each entry without
 *    cached_img_url, fetch its image, upload to Blob at
 *    `tracked/<sha1[:12]>.<ext>`, write back into the JSON file.
 *    auctionlots_scraper.py preserves the field across re-scrapes
 *    so the cached URL survives subsequent runs.
 *
 * Both passes also reap orphan blobs so removing an item from
 * watchlist or untracking a URL frees the space.
 *
 * Required env vars:
 *   BLOB_READ_WRITE_TOKEN  - Vercel Blob token (write access).
 *   SUPABASE_URL           - Same as the React app uses.
 *   SUPABASE_SERVICE_KEY   - Bypasses RLS so we can read across users.
 *
 * Run: node cache_watchlist_images.mjs
 */

import { put, list, del } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!BLOB_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("Missing env vars (BLOB_READ_WRITE_TOKEN/SUPABASE_URL/SUPABASE_SERVICE_KEY); skipping watchlist image cache.");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Hot-link-protected hosts need the dealer's own domain in Referer.
// Most dealers don't care; Watchfid is the known offender.
const REFERER_BY_HOST = {
  "www.watchfid.com": "https://www.watchfid.com/",
  "watchfid.com": "https://www.watchfid.com/",
};

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

async function fetchImage(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return null; }
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; Watchlist/1.0; +https://the-watch-list.app)",
    "Accept": "image/*,*/*;q=0.8",
  };
  if (REFERER_BY_HOST[host]) headers["Referer"] = REFERER_BY_HOST[host];
  let resp;
  try {
    resp = await fetch(url, { headers, redirect: "follow" });
  } catch (err) {
    return { error: `fetch threw: ${err.message}` };
  }
  if (!resp.ok) return { error: `HTTP ${resp.status}` };
  const buf = Buffer.from(await resp.arrayBuffer());
  const mime = (resp.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  return { buf, mime };
}

async function cacheUncached() {
  const { data: rows, error } = await supabase
    .from("watchlist_items")
    .select("id, listing_id, listing_snapshot, cached_img_url")
    .is("cached_img_url", null);
  if (error) { console.error("supabase select", error.message); return; }
  console.log(`${rows.length} watchlist row(s) without cached image`);

  for (const row of rows) {
    const listingId = row.listing_id;
    const img = (row.listing_snapshot || {}).img;
    if (!img) {
      // Mark as processed-without-image so we don't re-check every run.
      // An empty string is distinguishable from NULL in our query.
      await supabase.from("watchlist_items").update({ cached_img_url: "" }).eq("id", row.id);
      console.log(`  ${listingId}: no source image, marking processed`);
      continue;
    }
    const fetched = await fetchImage(img);
    if (!fetched || fetched.error) {
      console.log(`  ${listingId}: fetch failed (${fetched?.error || "no body"})`);
      continue;
    }
    const ext = EXT_BY_MIME[fetched.mime] || "bin";
    const pathname = `watchlist/${listingId}.${ext}`;
    try {
      const blob = await put(pathname, fetched.buf, {
        access: "public",
        contentType: fetched.mime,
        addRandomSuffix: false,
        // 1 year edge cache — these images don't change.
        cacheControlMaxAge: 31536000,
        token: BLOB_TOKEN,
      });
      const { error: upd } = await supabase
        .from("watchlist_items")
        .update({ cached_img_url: blob.url })
        .eq("id", row.id);
      if (upd) {
        console.error(`  ${listingId}: db update failed`, upd.message);
        continue;
      }
      console.log(`  ${listingId} cached: ${blob.url}`);
    } catch (err) {
      console.error(`  ${listingId}: upload failed`, err.message);
    }
  }
}

async function reapOrphans() {
  // List every blob under watchlist/, find the set of listing_ids
  // currently in watchlist_items, delete blobs whose listing_id isn't
  // in that set. Multiple users can watchlist the same listing — only
  // delete when no row references it.
  let cursor = undefined;
  const allBlobs = [];
  do {
    const page = await list({ prefix: "watchlist/", cursor, token: BLOB_TOKEN });
    allBlobs.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);

  const { data: rows, error } = await supabase
    .from("watchlist_items")
    .select("listing_id");
  if (error) { console.error("supabase select for cleanup", error.message); return; }
  const liveIds = new Set((rows || []).map(r => r.listing_id));

  let deleted = 0;
  for (const blob of allBlobs) {
    const m = blob.pathname.match(/^watchlist\/([^.]+)\./);
    if (!m) continue;
    const id = m[1];
    if (liveIds.has(id)) continue;
    try {
      await del(blob.url, { token: BLOB_TOKEN });
      deleted++;
    } catch (err) {
      console.error(`  cleanup delete failed: ${blob.pathname}`, err.message);
    }
  }
  console.log(`Reap pass: ${allBlobs.length} blob(s) found, ${deleted} orphan(s) deleted`);
}

// ── TRACKED-LOT IMAGE CACHE ────────────────────────────────────────────
// Stable 12-char URL id — matches merge.py's stable_id() so the same
// URL hashes consistently across Python + JS surfaces.
function urlIdFor(url) {
  if (!url) return "";
  const norm = url.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("?")[0].split("#")[0]
    .replace(/\/$/, "");
  return createHash("sha1").update(norm).digest("hex").slice(0, 12);
}

const TRACKED_LOTS_PATH = "public/tracked_lots.json";

async function cacheUncachedTrackedLots() {
  if (!existsSync(TRACKED_LOTS_PATH)) {
    console.log(`No ${TRACKED_LOTS_PATH} on disk; skipping tracked-lot image cache.`);
    return;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(TRACKED_LOTS_PATH, "utf8"));
  } catch (err) {
    console.error(`Could not read ${TRACKED_LOTS_PATH}:`, err.message);
    return;
  }
  if (!data || typeof data !== "object") return;

  let touched = 0;
  let cached = 0;
  for (const [url, entry] of Object.entries(data)) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.cached_img_url !== undefined) continue;  // already processed
    const img = entry.image;
    if (!img) {
      // Mark as processed-without-image so we don't re-check every run.
      entry.cached_img_url = "";
      touched++;
      continue;
    }
    const id = urlIdFor(url);
    const fetched = await fetchImage(img);
    if (!fetched || fetched.error) {
      console.log(`  tracked ${id}: fetch failed (${fetched?.error || "no body"})`);
      continue;
    }
    const ext = EXT_BY_MIME[fetched.mime] || "bin";
    const pathname = `tracked/${id}.${ext}`;
    try {
      const blob = await put(pathname, fetched.buf, {
        access: "public",
        contentType: fetched.mime,
        addRandomSuffix: false,
        cacheControlMaxAge: 31536000,
        token: BLOB_TOKEN,
      });
      entry.cached_img_url = blob.url;
      cached++;
      touched++;
      console.log(`  tracked ${id}: ${blob.url}`);
    } catch (err) {
      console.error(`  tracked ${id}: upload failed`, err.message);
    }
  }

  if (touched > 0) {
    writeFileSync(TRACKED_LOTS_PATH, JSON.stringify(data, null, 2) + "\n");
    console.log(`Tracked-lot pass: cached ${cached} new image(s), wrote ${TRACKED_LOTS_PATH}`);
  } else {
    console.log("Tracked-lot pass: nothing new to cache");
  }
}

async function reapTrackedOrphans() {
  // List every blob under tracked/, build the set of url-ids
  // currently referenced by ANY user's tracked_lots row, delete
  // blobs whose id isn't in the set. Multiple users can track the
  // same URL — only delete when no row references it.
  let cursor = undefined;
  const allBlobs = [];
  do {
    const page = await list({ prefix: "tracked/", cursor, token: BLOB_TOKEN });
    allBlobs.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);
  if (allBlobs.length === 0) {
    console.log("Tracked reap pass: no blobs found");
    return;
  }

  const { data: rows, error } = await supabase
    .from("tracked_lots")
    .select("lot_url");
  if (error) { console.error("supabase tracked_lots select", error.message); return; }
  const liveIds = new Set((rows || []).map(r => urlIdFor(r.lot_url)));

  let deleted = 0;
  for (const blob of allBlobs) {
    const m = blob.pathname.match(/^tracked\/([^.]+)\./);
    if (!m) continue;
    const id = m[1];
    if (liveIds.has(id)) continue;
    try {
      await del(blob.url, { token: BLOB_TOKEN });
      deleted++;
    } catch (err) {
      console.error(`  tracked cleanup delete failed: ${blob.pathname}`, err.message);
    }
  }
  console.log(`Tracked reap pass: ${allBlobs.length} blob(s) found, ${deleted} orphan(s) deleted`);
}

async function main() {
  await cacheUncached();
  await reapOrphans();
  await cacheUncachedTrackedLots();
  await reapTrackedOrphans();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
