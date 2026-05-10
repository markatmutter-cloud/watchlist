-- User profiles — display name + future user-level preferences.
-- 2026-05-10: created so users can override the auto-derived display
-- name (from auth metadata) with one of their choosing. Load-bearing
-- for the next reaction-on-shared-list feature: chips need a
-- consistent name to render against, not a bare email.
--
-- The existing surfaces (list_collaborators, list_members_for_collection,
-- the who_added chip) currently fall back to
-- auth.users.raw_user_meta_data.full_name → name → email. After this
-- migration they prefer user_profiles.display_name when set.

create table if not exists public.user_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS: anyone signed in can read any profile (display names are
-- visible across collaborators on shared lists, on reactions, on
-- comments). Each user can only insert/update their own row.
alter table public.user_profiles enable row level security;

-- Drop existing policies if re-running; idempotent.
drop policy if exists "user_profiles_select_all"   on public.user_profiles;
drop policy if exists "user_profiles_insert_self"  on public.user_profiles;
drop policy if exists "user_profiles_update_self"  on public.user_profiles;

create policy "user_profiles_select_all"
  on public.user_profiles
  for select
  using (true);

create policy "user_profiles_insert_self"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "user_profiles_update_self"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Touch updated_at on every UPDATE so the column reflects the most
-- recent change, not just the original insert.
create or replace function public.touch_user_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_profiles on public.user_profiles;
create trigger trg_touch_user_profiles
  before update on public.user_profiles
  for each row execute function public.touch_user_profiles_updated_at();

-- ── Update list_collaborators to prefer user_profiles.display_name ──
--
-- Owner-only roster RPC for the Manage list sheet. Today it falls
-- back to auth.users.raw_user_meta_data → full_name → name → email.
-- Now: prefer user_profiles.display_name when the row exists.

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
  select c.user_id into owner_uid from public.collections c where c.id = p_collection_id;
  if owner_uid is null or owner_uid <> uid then return; end if;
  return query
    select cc.id,
           cc.user_id,
           cc.invited_email,
           cc.role,
           cc.status,
           u.email::text,
           coalesce(
             up.display_name,
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email::text
           ),
           cc.created_at,
           cc.responded_at
      from public.collection_collaborators cc
      left join auth.users u            on u.id = cc.user_id
      left join public.user_profiles up on up.user_id = cc.user_id
     where cc.collection_id = p_collection_id
       and cc.status in ('pending', 'accepted')
     order by cc.created_at asc;
end;
$$;

grant execute on function public.list_collaborators(uuid) to authenticated;
revoke execute on function public.list_collaborators(uuid) from anon;

-- ── Update list_members_for_collection similarly ──────────────────
--
-- Member-only roster RPC used by the who_added attribution chip.

create or replace function public.list_members_for_collection(p_collection_id uuid)
returns table (
  user_id    uuid,
  user_email text,
  user_name  text,
  is_owner   boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
  is_member boolean;
begin
  if uid is null then return; end if;
  select c.user_id into owner_uid from public.collections c where c.id = p_collection_id;
  if owner_uid is null then return; end if;

  is_member := (uid = owner_uid) or exists (
    select 1 from public.collection_collaborators cc
     where cc.collection_id = p_collection_id
       and cc.user_id = uid
       and cc.status = 'accepted'
  );
  if not is_member then return; end if;

  -- Owner row.
  return query
    select u.id,
           u.email::text,
           coalesce(
             up.display_name,
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email::text
           ),
           true
      from auth.users u
      left join public.user_profiles up on up.user_id = u.id
     where u.id = owner_uid;

  -- Accepted collaborator rows.
  return query
    select u.id,
           u.email::text,
           coalesce(
             up.display_name,
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email::text
           ),
           false
      from public.collection_collaborators cc
      join auth.users u                  on u.id = cc.user_id
      left join public.user_profiles up  on up.user_id = cc.user_id
     where cc.collection_id = p_collection_id
       and cc.status = 'accepted';
end;
$$;

grant execute on function public.list_members_for_collection(uuid) to authenticated;
revoke execute on function public.list_members_for_collection(uuid) from anon;
