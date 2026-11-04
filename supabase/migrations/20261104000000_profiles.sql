-- 0001: profiles
--
-- One row per auth user, created automatically on sign-up. Owner-only access via RLS.
-- Deleting the auth user cascades to the profile (and, in later migrations, to all of the
-- user's collection data), which is the basis for the account-deletion flow.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  preferences  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 80),
  constraint profiles_avatar_url_length   check (avatar_url is null or char_length(avatar_url) <= 2048),
  constraint profiles_preferences_object  check (jsonb_typeof(preferences) = 'object')
);

comment on table  public.profiles is 'Per-user profile and preferences. Owner-only (RLS).';
comment on column public.profiles.preferences is 'Free-form UI preferences (clipboard format, defaults). Not security-relevant.';

-- ---------------------------------------------------------------------------
-- Row Level Security: a user can read and write only their own row.
-- (select auth.uid()) is wrapped so the planner evaluates it once per query.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: owner can select"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can insert"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy on purpose: profiles go away with the auth user (cascade).

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance (reused by every later table)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a user signs up.
-- SECURITY DEFINER because auth.users triggers run without an authenticated role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
