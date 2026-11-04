-- 0009: checklist library
--
-- A custom set's owner can publish its checklist (set, variants, cards, printings — never
-- ownership) to the library. Signed-in users browse published checklists, track one (a user_sets
-- row; their progress stays private) or copy it into a private custom set of their own.
-- Read access to catalog rows becomes: provider rows (anyone), own rows, public sets, and sets the
-- caller already tracks — so unpublishing never strands an existing collector's data. A trigger
-- stops anyone from tracking a private set they cannot otherwise read.

alter table public.catalog_sets
  add column visibility   text not null default 'private' check (visibility in ('private', 'public')),
  add column published_at timestamptz;
create index catalog_sets_public_idx on public.catalog_sets (published_at desc) where visibility = 'public';
comment on column public.catalog_sets.visibility is 'public = listed in the checklist library and readable by every signed-in user.';

-- ---------------------------------------------------------------------------
-- Readability helpers (SECURITY DEFINER so child-table policies do not re-run catalog_sets RLS).
-- ---------------------------------------------------------------------------
create or replace function public.catalog_set_readable(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.catalog_sets s
    where s.id = p_set_id
      and (s.owner_id is null
           or s.owner_id = auth.uid()
           or s.visibility = 'public'
           or exists (select 1 from public.user_sets us where us.catalog_set_id = s.id and us.user_id = auth.uid()))
  );
$$;
revoke execute on function public.catalog_set_readable(uuid) from public, anon;
grant  execute on function public.catalog_set_readable(uuid) to authenticated;

-- Tracking is allowed for provider sets, own sets and public sets only.
create or replace function public.catalog_set_trackable(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.catalog_sets s
    where s.id = p_set_id and (s.owner_id is null or s.owner_id = auth.uid() or s.visibility = 'public')
  );
$$;
revoke execute on function public.catalog_set_trackable(uuid) from public, anon;
grant  execute on function public.catalog_set_trackable(uuid) to authenticated;

create or replace function public.user_sets_check_trackable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.catalog_set_trackable(new.catalog_set_id) then
    raise exception 'set % is not available to track', new.catalog_set_id using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger user_sets_check_trackable before insert or update of catalog_set_id on public.user_sets
  for each row execute function public.user_sets_check_trackable();

-- ---------------------------------------------------------------------------
-- Read policies: provider rows stay readable by anon; signed-in users also read own, public and
-- tracked sets (and their children).
-- ---------------------------------------------------------------------------
drop policy "catalog_sets: shared or own read" on public.catalog_sets;
create policy "catalog_sets: provider read" on public.catalog_sets for select to anon, authenticated
  using (owner_id is null);
create policy "catalog_sets: own, public or tracked read" on public.catalog_sets for select to authenticated
  using (owner_id = (select auth.uid()) or visibility = 'public'
         or exists (select 1 from public.user_sets us where us.catalog_set_id = id and us.user_id = (select auth.uid())));

drop policy "catalog_cards: shared or own read" on public.catalog_cards;
create policy "catalog_cards: provider read" on public.catalog_cards for select to anon, authenticated
  using (owner_id is null);
create policy "catalog_cards: own or readable set" on public.catalog_cards for select to authenticated
  using (owner_id = (select auth.uid()) or public.catalog_set_readable(catalog_set_id));

drop policy "variant_definitions: shared or own read" on public.variant_definitions;
create policy "variant_definitions: provider read" on public.variant_definitions for select to anon, authenticated
  using (owner_id is null);
create policy "variant_definitions: own or readable set" on public.variant_definitions for select to authenticated
  using (owner_id = (select auth.uid()) or public.catalog_set_readable(catalog_set_id));

drop policy "card_printings: shared or own read" on public.card_printings;
create policy "card_printings: provider read" on public.card_printings for select to anon, authenticated
  using (owner_id is null);
create policy "card_printings: own or readable set" on public.card_printings for select to authenticated
  using (owner_id = (select auth.uid())
         or exists (select 1 from public.catalog_cards c where c.id = catalog_card_id and public.catalog_set_readable(c.catalog_set_id)));

-- ---------------------------------------------------------------------------
-- checklist_library: published sets with counts and a publisher name. Runs as the view owner
-- (no security_invoker) so it can read profiles.display_name; the WHERE clause is the boundary and
-- only whitelisted columns are exposed (never email, notes or ownership).
-- ---------------------------------------------------------------------------
create view public.checklist_library as
select
  s.id,
  s.name,
  s.set_code,
  s.series,
  s.release_date,
  s.language,
  s.description,
  s.card_order,
  s.published_at,
  s.updated_at,
  s.owner_id       as publisher_id,
  coalesce(nullif(p.display_name, ''), 'A collector') as publisher_name,
  g.id             as game_id,
  g.slug           as game_slug,
  g.name           as game_name,
  (select count(*) from public.catalog_cards c where c.catalog_set_id = s.id)        as card_count,
  (select count(*) from public.variant_definitions v where v.catalog_set_id = s.id)  as variant_count,
  (select count(*) from public.card_printings cp join public.catalog_cards c on c.id = cp.catalog_card_id
     where c.catalog_set_id = s.id)                                                  as printing_count,
  (select count(*) from public.user_sets us where us.catalog_set_id = s.id)          as tracker_count
from public.catalog_sets s
left join public.games g on g.id = s.game_id
left join public.profiles p on p.id = s.owner_id
where s.visibility = 'public';
revoke all on public.checklist_library from public, anon;
grant select on public.checklist_library to authenticated;

-- user_set_overview gains visibility (appended; views can only grow at the end).
create or replace view public.user_set_overview
with (security_invoker = true)
as
select
  us.id,
  us.user_id,
  us.catalog_set_id,
  us.tracking_name,
  us.status,
  us.favorite,
  us.created_at,
  us.updated_at,
  cs.name          as set_name,
  cs.set_code,
  cs.series,
  cs.release_date,
  cs.language,
  cs.description,
  cs.image_url,
  cs.owner_id      as set_owner_id,
  cs.provider_id,
  g.id             as game_id,
  g.slug           as game_slug,
  g.name           as game_name,
  (select count(*) from public.catalog_cards c where c.catalog_set_id = cs.id)        as card_count,
  (select count(*) from public.variant_definitions v where v.catalog_set_id = cs.id)  as variant_count,
  (select count(*) from public.card_printings p join public.catalog_cards c on c.id = p.catalog_card_id
     where c.catalog_set_id = cs.id)                                                  as printing_count,
  (select count(*) from public.collection_items ci where ci.user_set_id = us.id and ci.quantity > 0) as owned_printings,
  (select coalesce(sum(ci.quantity), 0) from public.collection_items ci where ci.user_set_id = us.id) as owned_quantity,
  cs.card_order,
  cs.visibility,
  (select count(*) from public.user_sets o where o.catalog_set_id = cs.id and o.user_id <> us.user_id) as other_tracker_count
from public.user_sets us
join public.catalog_sets cs on cs.id = us.catalog_set_id
left join public.games g on g.id = cs.game_id;

-- ---------------------------------------------------------------------------
-- set_catalog_set_visibility: owner publishes / unpublishes. Returns the new visibility.
-- ---------------------------------------------------------------------------
create or replace function public.set_catalog_set_visibility(p_set_id uuid, p_visibility text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_visibility not in ('private', 'public') then
    raise exception 'visibility must be private or public' using errcode = '22023';
  end if;
  update public.catalog_sets
  set visibility = p_visibility,
      published_at = case when p_visibility = 'public' then coalesce(published_at, now()) else published_at end
  where id = p_set_id and owner_id = (select auth.uid());
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'only the owner of a custom set can change its visibility' using errcode = '42501';
  end if;
  return p_visibility;
end;
$$;
revoke execute on function public.set_catalog_set_visibility(uuid, text) from public, anon;
grant  execute on function public.set_catalog_set_visibility(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- track_catalog_set: add a readable set to the caller's collection (idempotent). Returns user_set id.
-- ---------------------------------------------------------------------------
create or replace function public.track_catalog_set(p_set_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.user_sets (user_id, catalog_set_id)
  values ((select auth.uid()), p_set_id)
  on conflict (user_id, catalog_set_id) do update set updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.track_catalog_set(uuid) from public, anon;
grant  execute on function public.track_catalog_set(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- duplicate_catalog_set: private, editable copy of any set the caller can read (set, variants,
-- cards, printings; no ownership, no notes). Returns the new user_set id. SECURITY INVOKER.
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_catalog_set(p_source_set_id uuid, p_name text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_src public.catalog_sets;
  v_set uuid;
  v_user_set uuid;
begin
  if v_caller is null then
    raise exception 'duplicate_catalog_set() requires an authenticated user' using errcode = '42501';
  end if;
  select * into v_src from public.catalog_sets where id = p_source_set_id;
  if v_src.id is null then
    raise exception 'set % not found', p_source_set_id using errcode = 'P0002';
  end if;

  insert into public.catalog_sets (game_id, owner_id, name, set_code, series, release_date, language, description, image_url, metadata, card_order)
  values (v_src.game_id, v_caller, coalesce(nullif(p_name, ''), v_src.name), v_src.set_code, v_src.series, v_src.release_date, v_src.language, v_src.description, v_src.image_url, v_src.metadata, v_src.card_order)
  returning id into v_set;

  create temporary table dup_variants on commit drop as
    select id as old_id, gen_random_uuid() as new_id from public.variant_definitions where catalog_set_id = p_source_set_id;
  insert into public.variant_definitions (id, catalog_set_id, owner_id, slug, name, category, applies_by_default, position, metadata)
  select d.new_id, v_set, v_caller, v.slug, v.name, v.category, v.applies_by_default, v.position, v.metadata
  from public.variant_definitions v join dup_variants d on d.old_id = v.id;

  create temporary table dup_cards on commit drop as
    select id as old_id, gen_random_uuid() as new_id from public.catalog_cards where catalog_set_id = p_source_set_id;
  insert into public.catalog_cards (id, catalog_set_id, owner_id, name, number, rarity, artist, language, image_url, external_ids, metadata, position)
  select d.new_id, v_set, v_caller, c.name, c.number, c.rarity, c.artist, c.language, c.image_url, c.external_ids, c.metadata, c.position
  from public.catalog_cards c join dup_cards d on d.old_id = c.id;

  insert into public.card_printings (catalog_card_id, variant_definition_id, owner_id, image_url, metadata)
  select dc.new_id, dv.new_id, v_caller, p.image_url, p.metadata
  from public.card_printings p
  join dup_cards dc on dc.old_id = p.catalog_card_id
  join dup_variants dv on dv.old_id = p.variant_definition_id;

  insert into public.user_sets (user_id, catalog_set_id) values (v_caller, v_set) returning id into v_user_set;
  return v_user_set;
end;
$$;
revoke execute on function public.duplicate_catalog_set(uuid, text) from public, anon;
grant  execute on function public.duplicate_catalog_set(uuid, text) to authenticated;
