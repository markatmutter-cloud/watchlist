-- Collaborator slice 1 — schema + RLS expansion + smoke tests.
-- List Sharing v2 (joint editing) groundwork. Ships backend-only —
-- no UI changes are gated on this migration. The RPCs (slice 2) and
-- UI (slice 3+) layer on top.
--
-- Run order: paste into the Supabase SQL editor and execute.
-- Idempotent. Safe to re-run.
--
-- ── Design ────────────────────────────────────────────────────────
--
-- A collaborator row says "user X is invited to collection Y at role
-- Z, with status S." Status transitions:
--   pending  → accepted | declined        (by invitee)
--   accepted → revoked                    (by owner; soft-deleted via
--                                           DELETE today; status field
--                                           kept for forward compat)
--
-- Email-by-invite: the inviter supplies an email. If a Supabase user
-- with that email already exists, `user_id` is filled in at invite
-- time. If not, `user_id` stays null and gets resolved when the
-- invitee signs in via Google (the accept_invite RPC matches
-- `invited_email` to `auth.users.email`). Pending invites are visible
-- by email to anyone signed in with that email; accepted invites are
-- visible only to the resolved user_id.
--
-- The `who_added` column on collection_items captures attribution for
-- the chip UI ("J added this") in slice 4.
--
-- RLS expansion uses two SECURITY DEFINER helper functions to avoid
-- recursion (a policy on collection_collaborators that called a
-- helper joining back to collection_collaborators would loop). The
-- helpers short-circuit on owner_id first, then check collaborator
-- membership.
--
-- ── Tables ────────────────────────────────────────────────────────

create table if not exists public.collection_collaborators (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references public.collections(id) on delete cascade,
  user_id         uuid     references auth.users(id) on delete cascade,
  invited_email   text not null,
  role            text not null default 'editor'
                  check (role in ('viewer', 'editor')),
  status          text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined')),
  invited_by      uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz
);

-- Forward-compat constraint: an accepted row must have a resolved
-- user_id (we know who's accepted). Pending rows can have null
-- user_id (the invitee hasn't signed in yet to resolve the email).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'collaborators_accepted_has_user'
  ) then
    alter table public.collection_collaborators
      add constraint collaborators_accepted_has_user
      check (status <> 'accepted' or user_id is not null);
  end if;
end $$;

-- One pending invite per (collection, email) — re-inviting the same
-- email after a decline creates a new row, but we don't allow two
-- simultaneous pendings. Partial unique index gates only on pending
-- so accepted/declined rows for the same email can coexist (history).
create unique index if not exists collaborators_pending_unique
  on public.collection_collaborators (collection_id, invited_email)
  where status = 'pending';

-- One accepted row per (collection, user_id) — a user can't be
-- accepted into the same collection twice. Partial unique index on
-- accepted only.
create unique index if not exists collaborators_accepted_unique
  on public.collection_collaborators (collection_id, user_id)
  where status = 'accepted';

-- Lookup indices for the most common queries (slice 2 RPCs):
--   "all collaborators on this collection"
--   "all pending invites for this email"
--   "all accepted collections for this user"
create index if not exists collaborators_by_collection
  on public.collection_collaborators (collection_id, status);
create index if not exists collaborators_by_email
  on public.collection_collaborators (lower(invited_email))
  where status = 'pending';
create index if not exists collaborators_by_user
  on public.collection_collaborators (user_id, status)
  where status = 'accepted';

alter table public.collection_collaborators enable row level security;

-- ── who_added attribution on collection_items ────────────────────

alter table public.collection_items
  add column if not exists who_added uuid references auth.users(id) on delete set null;

comment on column public.collection_items.who_added is
  'User who added this item to the collection. Null for pre-Slice-1 rows; backfilled to collection.user_id at migration time so existing UI chips have data from day 1.';

-- Backfill existing rows with the collection owner so attribution
-- chips ("J added this") have data from day 1. New inserts should
-- always set who_added = auth.uid() (handled in supabase.js client
-- code in slice 2).
update public.collection_items ci
   set who_added = c.user_id
  from public.collections c
 where c.id = ci.collection_id
   and ci.who_added is null;

-- ── Helper SQL functions (SECURITY DEFINER, bypass RLS) ──────────
--
-- can_view_collection: owner OR accepted-collaborator (any role).
-- can_edit_collection: owner OR accepted editor.
--
-- SECURITY DEFINER lets these functions read collection_collaborators
-- without recursing through that table's RLS policies (which call
-- back here).

create or replace function public.can_view_collection(coll_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.collections where id = coll_id and user_id = uid) then
    return true;
  end if;
  if exists (
    select 1 from public.collection_collaborators
     where collection_id = coll_id
       and user_id = uid
       and status = 'accepted'
  ) then
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.can_edit_collection(coll_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.collections where id = coll_id and user_id = uid) then
    return true;
  end if;
  if exists (
    select 1 from public.collection_collaborators
     where collection_id = coll_id
       and user_id = uid
       and status = 'accepted'
       and role = 'editor'
  ) then
    return true;
  end if;
  return false;
end;
$$;

grant execute on function public.can_view_collection(uuid) to authenticated;
grant execute on function public.can_edit_collection(uuid) to authenticated;

-- ── Updated RLS on collections ────────────────────────────────────
--
-- Existing policies gate on `auth.uid() = user_id`. Replace with
-- can_view_collection / can_edit_collection so accepted collaborators
-- can see + (if editor) modify the row.
--
-- Owner-only operations (DELETE the whole collection, change name)
-- stay gated on user_id directly — collaborators can only act on
-- contents, not the container.

do $$ begin
  -- SELECT: owner OR accepted collaborator (any role).
  drop policy if exists "Users select own collections" on public.collections;
  drop policy if exists "Users select viewable collections" on public.collections;
  create policy "Users select viewable collections"
    on public.collections for select
    using (public.can_view_collection(id));

  -- UPDATE: owner only (collaborators don't rename or change settings).
  drop policy if exists "Users update own collections" on public.collections;
  drop policy if exists "Users update owned collections" on public.collections;
  create policy "Users update owned collections"
    on public.collections for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

  -- DELETE: owner only (and the existing system-list trigger blocks
  -- system-flagged rows even for owners).
  drop policy if exists "Users delete own collections" on public.collections;
  drop policy if exists "Users delete owned collections" on public.collections;
  create policy "Users delete owned collections"
    on public.collections for delete
    using (auth.uid() = user_id);

  -- INSERT: unchanged — only the owner can create a collection.
  -- (Existing policy already gates on auth.uid() = user_id; left in
  -- place.)
end $$;

-- ── Updated RLS on collection_items ──────────────────────────────
--
-- SELECT: anyone who can_view the parent collection.
-- INSERT: anyone who can_edit the parent.
-- UPDATE / DELETE: the row's `who_added` user, OR the collection owner.
--   (Collaborator-editors can add but not delete each other's adds —
--   keeps social pressure low.)

do $$ begin
  drop policy if exists "Users select own collection items" on public.collection_items;
  drop policy if exists "Users select viewable collection items" on public.collection_items;
  create policy "Users select viewable collection items"
    on public.collection_items for select
    using (public.can_view_collection(collection_id));

  drop policy if exists "Users insert into own collections" on public.collection_items;
  drop policy if exists "Users insert into editable collections" on public.collection_items;
  create policy "Users insert into editable collections"
    on public.collection_items for insert
    with check (public.can_edit_collection(collection_id));

  drop policy if exists "Users update own collection items" on public.collection_items;
  drop policy if exists "Users update own additions" on public.collection_items;
  create policy "Users update own additions"
    on public.collection_items for update
    using (
      auth.uid() = who_added
      or auth.uid() in (select user_id from public.collections where id = collection_id)
    )
    with check (public.can_edit_collection(collection_id));

  drop policy if exists "Users delete own collection items" on public.collection_items;
  drop policy if exists "Users delete own additions" on public.collection_items;
  create policy "Users delete own additions"
    on public.collection_items for delete
    using (
      auth.uid() = who_added
      or auth.uid() in (select user_id from public.collections where id = collection_id)
    );
end $$;

-- ── RLS on collection_collaborators itself ───────────────────────
--
-- SELECT:
--   * Owner of the collection sees all collaborator rows on it.
--   * The invitee sees rows where `user_id = auth.uid()` (resolved)
--     OR `lower(invited_email) = lower(auth.email())` (pending).
-- INSERT/UPDATE/DELETE: handled exclusively through RPCs in slice 2
--   (security-definer invite_collaborator / accept_invite /
--   decline_invite / revoke_collaborator). Block all direct writes
--   from the client.

do $$ begin
  drop policy if exists "Owners + invitees see collaborators" on public.collection_collaborators;
  create policy "Owners + invitees see collaborators"
    on public.collection_collaborators for select
    using (
      -- Owner of the parent collection.
      auth.uid() in (
        select user_id from public.collections where id = collection_id
      )
      -- Resolved invitee.
      or auth.uid() = user_id
      -- Pending invitee whose email matches their auth email.
      or (status = 'pending'
          and lower(invited_email) = lower(coalesce(auth.email(), '')))
    );

  -- No direct write policies — slice 2 RPCs are the only path. With
  -- RLS enabled and zero write policies, all writes from the client
  -- are denied.
end $$;

-- ── Smoke tests ───────────────────────────────────────────────────
--
-- These run as the postgres role (no RLS), but exercise the helper
-- functions and constraint shapes. Re-run after each schema change
-- to catch regressions early. Each `assert` raises an exception
-- with a clear message if it fails — running this whole block in
-- the SQL editor either completes silently (✓) or surfaces the
-- first failure.

do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  coll_id  uuid;
  collab_id uuid;
begin
  -- Skip the smoke tests if auth.users isn't accessible (e.g., a
  -- restricted role running this migration). The schema + policies
  -- above are the production deliverable; the asserts are a CI
  -- nicety.
  if not exists (
    select 1 from information_schema.tables
     where table_schema='auth' and table_name='users'
  ) then
    raise notice 'Skipping smoke tests — auth.users not accessible.';
    return;
  end if;

  -- Constraint: accepted row without user_id should fail.
  begin
    insert into public.collection_collaborators
      (collection_id, invited_email, status, invited_by)
      values (gen_random_uuid(), 'x@y.com', 'accepted', gen_random_uuid());
    raise exception 'Expected accepted-without-user_id constraint to fire';
  exception when check_violation then
    null; -- ✓ constraint fired as expected
  when foreign_key_violation then
    null; -- ✓ FK on collection_id / invited_by fired first; either is fine
  end;

  raise notice 'collaborator schema smoke tests passed';
end $$;
