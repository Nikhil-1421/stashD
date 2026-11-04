-- 0006: collection tracking + requirements
--
-- collection_items: what a user owns, per tracked set and printing. A row with quantity 0 keeps its
-- condition/notes (ownership history is never erased by requirement changes — invariant 4).
-- user_set_requirements: include/exclude rules that decide which printings count toward
-- completion. Resolution (most specific wins): printing > card > variant > variant_category >
-- default include. Completion itself is computed in the client domain layer, never persisted.

create table public.collection_items (
  id          uuid primary key default gen_random_uuid(),
  user_set_id uuid not null references public.user_sets (id) on delete cascade,
  printing_id uuid not null references public.card_printings (id) on delete cascade,
  quantity    integer not null default 1 check (quantity >= 0 and quantity <= 9999),
  condition   text check (condition is null or char_length(condition) <= 40),
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_set_id, printing_id)
);
comment on table public.collection_items is 'Ownership per (tracked set, printing). quantity 0 = not owned but keeps notes.';
create index collection_items_printing_idx on public.collection_items (printing_id);

alter table public.collection_items enable row level security;
create policy "collection_items: owner select" on public.collection_items for select to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "collection_items: owner insert" on public.collection_items for insert to authenticated
  with check (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "collection_items: owner update" on public.collection_items for update to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())))
  with check (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "collection_items: owner delete" on public.collection_items for delete to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
grant select, insert, update, delete on public.collection_items to authenticated;
revoke all on public.collection_items from anon;
create trigger collection_items_set_updated_at before update on public.collection_items
  for each row execute function public.set_updated_at();

-- The printing must belong to the catalog set the user_set tracks (runs as caller; RLS applies).
create or replace function public.collection_items_check_printing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tracked_set uuid;
  printing_set uuid;
begin
  select catalog_set_id into tracked_set from public.user_sets where id = new.user_set_id;
  select c.catalog_set_id into printing_set
  from public.card_printings p join public.catalog_cards c on c.id = p.catalog_card_id
  where p.id = new.printing_id;
  if tracked_set is null or printing_set is null or tracked_set <> printing_set then
    raise exception 'printing % does not belong to the tracked set', new.printing_id using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger collection_items_check_printing before insert or update of user_set_id, printing_id on public.collection_items
  for each row execute function public.collection_items_check_printing();

-- ---------------------------------------------------------------------------
create table public.user_set_requirements (
  id          uuid primary key default gen_random_uuid(),
  user_set_id uuid not null references public.user_sets (id) on delete cascade,
  scope       text not null check (scope in ('variant_category', 'variant', 'card', 'printing')),
  target      text not null check (char_length(target) between 1 and 60),
  action      text not null check (action in ('include', 'exclude')),
  created_at  timestamptz not null default now(),
  unique (user_set_id, scope, target)
);
comment on table public.user_set_requirements is 'Include/exclude rules; target is a uuid (variant/card/printing) or a category name. Most specific scope wins.';

alter table public.user_set_requirements enable row level security;
create policy "user_set_requirements: owner select" on public.user_set_requirements for select to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "user_set_requirements: owner insert" on public.user_set_requirements for insert to authenticated
  with check (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "user_set_requirements: owner update" on public.user_set_requirements for update to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())))
  with check (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "user_set_requirements: owner delete" on public.user_set_requirements for delete to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
grant select, insert, update, delete on public.user_set_requirements to authenticated;
revoke all on public.user_set_requirements from anon;

-- ---------------------------------------------------------------------------
-- set_collection_item: upsert by (user_set, printing). Partial patch: nulls leave fields alone.
-- Returns the row. SECURITY INVOKER.
-- ---------------------------------------------------------------------------
create or replace function public.set_collection_item(
  p_user_set_id uuid,
  p_printing_id uuid,
  p_quantity integer default null,
  p_condition text default null,
  p_notes text default null
)
returns public.collection_items
language plpgsql
set search_path = ''
as $$
declare
  row_out public.collection_items;
begin
  insert into public.collection_items (user_set_id, printing_id, quantity, condition, notes)
  values (p_user_set_id, p_printing_id, coalesce(p_quantity, 1), nullif(p_condition, ''), nullif(p_notes, ''))
  on conflict (user_set_id, printing_id) do update
    set quantity  = coalesce(excluded.quantity, public.collection_items.quantity),
        condition = case when p_condition is null then public.collection_items.condition else nullif(p_condition, '') end,
        notes     = case when p_notes is null then public.collection_items.notes else nullif(p_notes, '') end
  returning * into row_out;
  return row_out;
end;
$$;
revoke execute on function public.set_collection_item(uuid, uuid, integer, text, text) from public, anon;
grant  execute on function public.set_collection_item(uuid, uuid, integer, text, text) to authenticated;

-- user_set_overview gains owned counts so list screens can show progress cheaply.
-- (Required counts depend on rules and are computed client-side; owned_printings is rule-free.)
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
  (select coalesce(sum(ci.quantity), 0) from public.collection_items ci where ci.user_set_id = us.id) as owned_quantity
from public.user_sets us
join public.catalog_sets cs on cs.id = us.catalog_set_id
left join public.games g on g.id = cs.game_id;

grant select on public.user_set_overview to authenticated;
