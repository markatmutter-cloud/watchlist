-- ═══════════════════════════════════════════════════════════════════
-- COMBINED MIGRATION — 2026-05-07
-- ═══════════════════════════════════════════════════════════════════
--
-- One-shot script covering every migration that landed during the
-- 2026-05-07 build session. Paste this whole file into the Supabase
-- SQL editor and run; idempotent on every section, so safe to re-run
-- if you've already applied any of these individually.
--
-- Sections (in apply-order — later sections depend on earlier ones):
--   1. manual_source_url       — optional URL on Owned/Sold manual entries
--   2. public_list             — read-only list-share RPC
--   3. collection_collaborators — joint-editing schema (slice 1)
--   4. collaborator_rpcs       — invite/accept/decline/revoke RPCs (slice 2)
--
-- After running, the live site supports:
--   * Add to Shortlist / Owned / Sold / Lists (was blocked by missing
--     who_added column; the slice-1 section adds it).
--   * Sharing a list via /?list=<id>&shared=1 (read-only).
--   * Inviting collaborators by email (slice 2 + 3 UI live in
--     production).

-- ═══════════════════════════════════════════════════════════════════
-- 1) MANUAL SOURCE URL
-- ═══════════════════════════════════════════════════════════════════
-- Optional URL field for manual entries — dealer / eBay / auction
-- lot URL the user pasted when adding a watch they own or sold.

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS manual_source_url text;

COMMENT ON COLUMN collection_items.manual_source_url IS
  'Optional URL the user pasted when manually adding a watch — typically the dealer listing, eBay sold page, or auction lot URL.';

-- ═══════════════════════════════════════════════════════════════════
-- 2) PUBLIC LIST (read-only share RPC)
-- ═══════════════════════════════════════════════════════════════════
-- Security-definer RPC that returns a list + items when the list is
-- a regular user list (type='free-form'). System lists, challenges,
-- and shared inboxes return null silently.

create or replace function public.get_public_list(list_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  c record;
  items jsonb;
begin
  select id, name, user_id, type, is_system, is_shared_inbox,
         created_at, updated_at
    into c
    from public.collections
    where id = list_id
      and type = 'free-form'
      and is_system is not true
      and (is_shared_inbox is null or is_shared_inbox = false);
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'rowId',          ci.id,
    'listingId',      ci.listing_id,
    'savedPrice',     ci.saved_price,
    'savedCurrency',  ci.saved_currency,
    'savedPriceUSD',  ci.saved_price_usd,
    'addedAt',        ci.added_at,
    'isManual',       coalesce(ci.is_manual, false),
    'manualImageUrl',     ci.manual_image_url,
    'manualBrand',        ci.manual_brand,
    'manualModel',        ci.manual_model,
    'manualReference',    ci.manual_reference,
    'manualMaterial',     ci.manual_material,
    'manualPricePaid',    ci.manual_price_paid,
    'manualPriceCurrency',ci.manual_price_currency,
    'manualSoldPrice',    ci.manual_sold_price,
    'manualSoldDate',     ci.manual_sold_date,
    'manualComments',     ci.manual_comments,
    'manualSourceUrl',    ci.manual_source_url
  ) order by ci.added_at), '[]'::jsonb)
    into items
    from public.collection_items ci
    where ci.collection_id = list_id;

  return jsonb_build_object(
    'id',         c.id,
    'name',       c.name,
    'ownerId',    c.user_id,
    'createdAt',  c.created_at,
    'updatedAt',  c.updated_at,
    'items',      items
  );
end;
$$;

grant execute on function public.get_public_list(uuid) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 3) COLLECTION COLLABORATORS (slice 1: schema + RLS expansion)
-- ═══════════════════════════════════════════════════════════════════
-- Tables, helper functions, and updated RLS so accepted collaborators
-- can read + (if editor) edit a collection their owner shared.

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

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'collaborators_accepted_has_user'
  ) then
    alter table public.collection_collaborators
      add constraint collaborators_accepted_has_user
      check (status <> 'accepted' or user_id is not null);
  end if;
end $$;

create unique index if not exists collaborators_pending_unique
  on public.collection_collaborators (collection_id, invited_email)
  where status = 'pending';

create unique index if not exists collaborators_accepted_unique
  on public.collection_collaborators (collection_id, user_id)
  where status = 'accepted';

create index if not exists collaborators_by_collection
  on public.collection_collaborators (collection_id, status);
create index if not exists collaborators_by_email
  on public.collection_collaborators (lower(invited_email))
  where status = 'pending';
create index if not exists collaborators_by_user
  on public.collection_collaborators (user_id, status)
  where status = 'accepted';

alter table public.collection_collaborators enable row level security;

-- who_added attribution on collection_items.
alter table public.collection_items
  add column if not exists who_added uuid references auth.users(id) on delete set null;

comment on column public.collection_items.who_added is
  'User who added this item. Null for pre-Slice-1 rows; backfilled to collection.user_id for existing rows so attribution chips have data from day 1.';

update public.collection_items ci
   set who_added = c.user_id
  from public.collections c
 where c.id = ci.collection_id
   and ci.who_added is null;

-- Helper SQL functions (SECURITY DEFINER — bypass RLS to avoid
-- recursive policy lookups).
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

-- Updated RLS on collections.
do $$ begin
  drop policy if exists "Users select own collections" on public.collections;
  drop policy if exists "Users select viewable collections" on public.collections;
  create policy "Users select viewable collections"
    on public.collections for select
    using (public.can_view_collection(id));

  drop policy if exists "Users update own collections" on public.collections;
  drop policy if exists "Users update owned collections" on public.collections;
  create policy "Users update owned collections"
    on public.collections for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

  drop policy if exists "Users delete own collections" on public.collections;
  drop policy if exists "Users delete owned collections" on public.collections;
  create policy "Users delete owned collections"
    on public.collections for delete
    using (auth.uid() = user_id);
end $$;

-- Updated RLS on collection_items.
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

-- RLS on the collaborators table itself.
do $$ begin
  drop policy if exists "Owners + invitees see collaborators" on public.collection_collaborators;
  create policy "Owners + invitees see collaborators"
    on public.collection_collaborators for select
    using (
      auth.uid() in (
        select user_id from public.collections where id = collection_id
      )
      or auth.uid() = user_id
      or (status = 'pending'
          and lower(invited_email) = lower(coalesce(auth.email(), '')))
    );
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4) COLLABORATOR RPCS (slice 2: invite / accept / decline / revoke)
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.invite_collaborator(
  p_collection_id uuid,
  p_email         text,
  p_role          text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
  normalized_email text := lower(trim(p_email));
  resolved_user_id uuid;
  existing_id uuid;
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if normalized_email = '' then raise exception 'email required' using errcode = '22023'; end if;
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if p_role not in ('viewer', 'editor') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  select user_id into owner_uid from public.collections where id = p_collection_id;
  if owner_uid is null then
    raise exception 'collection not found' using errcode = '02000';
  end if;
  if owner_uid <> uid then
    raise exception 'only the owner can invite collaborators' using errcode = '42501';
  end if;

  if lower(coalesce((select email from auth.users where id = uid), '')) = normalized_email then
    raise exception 'cannot invite yourself' using errcode = '22023';
  end if;

  select id into resolved_user_id
    from auth.users
   where lower(email) = normalized_email
   limit 1;

  if resolved_user_id is not null then
    if exists (
      select 1 from public.collection_collaborators
       where collection_id = p_collection_id
         and user_id = resolved_user_id
         and status = 'accepted'
    ) then
      raise exception 'already a collaborator' using errcode = '23505';
    end if;
  end if;

  select id into existing_id
    from public.collection_collaborators
   where collection_id = p_collection_id
     and lower(invited_email) = normalized_email
     and status = 'pending'
   limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.collection_collaborators
    (collection_id, user_id, invited_email, role, status, invited_by)
    values (p_collection_id, resolved_user_id, normalized_email, p_role, 'pending', uid)
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.accept_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_email text;
  inv record;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select lower(email) into caller_email from auth.users where id = uid;
  if caller_email is null then
    raise exception 'caller email missing' using errcode = '42501';
  end if;
  select id, collection_id, invited_email, status into inv
    from public.collection_collaborators
   where id = p_invite_id;
  if inv.id is null then raise exception 'invite not found' using errcode = '02000'; end if;
  if inv.status <> 'pending' then
    raise exception 'invite is not pending' using errcode = '22023';
  end if;
  if lower(inv.invited_email) <> caller_email then
    raise exception 'this invite is for a different email' using errcode = '42501';
  end if;
  update public.collection_collaborators
     set status = 'accepted',
         user_id = uid,
         responded_at = now()
   where id = p_invite_id;
end;
$$;

create or replace function public.decline_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_email text;
  inv record;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select lower(email) into caller_email from auth.users where id = uid;
  if caller_email is null then
    raise exception 'caller email missing' using errcode = '42501';
  end if;
  select id, invited_email, status into inv
    from public.collection_collaborators
   where id = p_invite_id;
  if inv.id is null then raise exception 'invite not found' using errcode = '02000'; end if;
  if inv.status <> 'pending' then
    raise exception 'invite is not pending' using errcode = '22023';
  end if;
  if lower(inv.invited_email) <> caller_email then
    raise exception 'this invite is for a different email' using errcode = '42501';
  end if;
  update public.collection_collaborators
     set status = 'declined',
         responded_at = now()
   where id = p_invite_id;
end;
$$;

create or replace function public.revoke_collaborator(
  p_collection_id uuid,
  p_user_id       uuid default null,
  p_invite_id     uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select user_id into owner_uid from public.collections where id = p_collection_id;
  if owner_uid is null then raise exception 'collection not found' using errcode = '02000'; end if;
  if owner_uid <> uid then
    raise exception 'only the owner can revoke collaborators' using errcode = '42501';
  end if;
  if p_invite_id is not null then
    delete from public.collection_collaborators
     where id = p_invite_id and collection_id = p_collection_id;
  elsif p_user_id is not null then
    delete from public.collection_collaborators
     where collection_id = p_collection_id and user_id = p_user_id;
  else
    raise exception 'pass either p_user_id or p_invite_id' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.pending_invites_for_me()
returns table (
  invite_id      uuid,
  collection_id  uuid,
  collection_name text,
  inviter_email  text,
  inviter_name   text,
  role           text,
  invited_email  text,
  created_at     timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_email text;
begin
  if uid is null then return; end if;
  select lower(email) into caller_email from auth.users where id = uid;
  if caller_email is null then return; end if;
  return query
    select cc.id,
           cc.collection_id,
           c.name,
           u.email,
           coalesce(
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email
           ),
           cc.role,
           cc.invited_email,
           cc.created_at
      from public.collection_collaborators cc
      join public.collections c on c.id = cc.collection_id
      join auth.users u on u.id = cc.invited_by
     where cc.status = 'pending'
       and lower(cc.invited_email) = caller_email
     order by cc.created_at desc;
end;
$$;

create or replace function public.list_collaborators(p_collection_id uuid)
returns table (
  invite_id     uuid,
  user_id       uuid,
  invited_email text,
  role          text,
  status        text,
  user_email    text,
  user_name     text,
  created_at    timestamptz,
  responded_at  timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
begin
  if uid is null then return; end if;
  select user_id into owner_uid from public.collections where id = p_collection_id;
  if owner_uid is null or owner_uid <> uid then return; end if;
  return query
    select cc.id,
           cc.user_id,
           cc.invited_email,
           cc.role,
           cc.status,
           u.email,
           coalesce(
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email
           ),
           cc.created_at,
           cc.responded_at
      from public.collection_collaborators cc
      left join auth.users u on u.id = cc.user_id
     where cc.collection_id = p_collection_id
       and cc.status in ('pending', 'accepted')
     order by cc.created_at asc;
end;
$$;

grant execute on function public.invite_collaborator(uuid, text, text) to authenticated;
grant execute on function public.accept_invite(uuid)                   to authenticated;
grant execute on function public.decline_invite(uuid)                  to authenticated;
grant execute on function public.revoke_collaborator(uuid, uuid, uuid) to authenticated;
grant execute on function public.pending_invites_for_me()              to authenticated;
grant execute on function public.list_collaborators(uuid)              to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════
-- After running:
--   1. Refresh the Supabase API schema cache (Settings → API → Reload)
--      so the new columns + RPCs become visible to PostgREST. Without
--      this step, the JS client may still report "column not found"
--      for ~60 seconds even though the column exists.
--   2. Verify by running:
--        select column_name from information_schema.columns
--         where table_name='collection_items' and column_name='who_added';
--      Should return one row.
do $$ begin
  raise notice 'COMBINED 2026-05-07 migration complete.';
end $$;
