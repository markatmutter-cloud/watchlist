# Auction lot tracking — one-time setup

Two things to do once before the Antiquorum lot scraper can run end-to-end.

## 1. Create the Supabase table

Open the Supabase SQL editor for the `dial-watchlist` project and run:

```sql
create table if not exists public.tracked_lots (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  lot_url     text        not null,
  added_at    timestamptz not null default now(),
  unique (user_id, lot_url)
);

alter table public.tracked_lots enable row level security;

create policy "Users see their own tracked lots"
  on public.tracked_lots for select
  using (auth.uid() = user_id);

create policy "Users add their own tracked lots"
  on public.tracked_lots for insert
  with check (auth.uid() = user_id);

create policy "Users delete their own tracked lots"
  on public.tracked_lots for delete
  using (auth.uid() = user_id);
```

The unique constraint prevents the same user from accidentally tracking the
same lot twice. RLS policies match the pattern used by `watchlist_items`,
`hidden_listings`, and `saved_searches`.

## 2. Add GitHub Action secrets

The cron-driven `auctionlots_scraper.py` needs to read tracked URLs from
Supabase using the service-role key (it bypasses RLS to see all users'
URLs in one query). Add these two secrets to the repo at
`Settings → Secrets and variables → Actions`:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://<your-project>.supabase.co` (same as `REACT_APP_SUPABASE_URL` in Vercel) |
| `SUPABASE_SERVICE_KEY` | The service-role key from Supabase → Project settings → API |

⚠️ The service-role key is sensitive — it bypasses RLS. Only put it in
GitHub repo secrets, never in `.env.local` or anywhere committed to git.

## Done

After both steps:

- Sign into Watchlist on the live site, scroll to the Auction lots section,
  paste an Antiquorum lot URL like
  `https://live.antiquorum.swiss/lots/view/1-CECBOW/omega`, click + Track.
- The card shows as "Pending" until the next cron run (or until you
  trigger the workflow manually from Actions → Scrape watch listings →
  Run workflow). After that it fills in with image, title, estimate,
  current bid, and a countdown to the auction end time.
- After the auction ends, the next scrape captures the hammer price and
  the lot moves to the Past sub-tab.
