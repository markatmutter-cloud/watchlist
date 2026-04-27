/**
 * Watchlist image caching.
 *
 * For every row in watchlist_items without a cached_img_url, fetch the
 * dealer image (with appropriate Referer for hot-link-protected hosts),
 * upload to Vercel Blob at `watchlist/<listing_id>.<ext>`, and write
 * the resulting URL back to the Supabase row. Once a listing is
 * cached, the image survives the dealer deleting the original file.
 *
 * Also reaps orphan blobs (uploaded to Blob, but no longer referenced
 * by any watchlist_items row) so unfavoriting an item frees the space.
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

async function main() {
  await cacheUncached();
  await reapOrphans();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
