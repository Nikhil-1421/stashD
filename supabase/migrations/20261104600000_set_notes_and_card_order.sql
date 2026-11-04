-- 0008: per-set notes + manual card order
--
-- user_set_notes: free-text, timestamped notes per tracked set (the reference app's Notes sheet).
-- catalog_sets.card_order: 'number' (natural sort of the card number, then position) or 'manual'
-- (position first). Only a custom set's owner can change it (existing catalog_sets owner policy).
-- reorder_catalog_cards: writes positions for a full ordered id list in one statement.

create table public.user_set_notes (
  id          uuid primary key default gen_random_uuid(),
  user_set_id uuid not null references public.user_sets (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index user_set_notes_set_idx on public.user_set_notes (user_set_id, created_at desc);

alter table public.user_set_notes enable row level security;
create policy "user_set_notes: owner select" on public.user_set_notes for select to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "user_set_notes: owner insert" on public.user_set_notes for insert to authenticated
  with check (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "user_set_notes: owner update" on public.user_set_notes for update to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())))
  with check (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
create policy "user_set_notes: owner delete" on public.user_set_notes for delete to authenticated
  using (exists (select 1 from public.user_sets us where us.id = user_set_id and us.user_id = (select auth.uid())));
grant select, insert, update, delete on public.user_set_notes to authenticated;
revoke all on public.user_set_notes from anon;
create trigger user_set_notes_set_updated_at before update on public.user_set_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
alter table public.catalog_sets
  add column card_order text not null default 'number' check (card_order in ('number', 'manual'));
comment on column public.catalog_sets.card_order is 'number: order by card_number_sort_key then position; manual: position first.';

-- Append card_order to the overview (columns may only be added at the end of an existing view).
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
  cs.card_order
from public.user_sets us
join public.catalog_sets cs on cs.id = us.catalog_set_id
left join public.games g on g.id = cs.game_id;

-- ---------------------------------------------------------------------------
-- reorder_catalog_cards: p_card_ids is the complete new order of the set's cards. Positions are
-- rewritten in one statement; RLS on catalog_cards applies (owner of a custom set only), so a
-- caller without update rights changes nothing and gets an error.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_catalog_cards(p_catalog_set_id uuid, p_card_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
  v_updated integer;
begin
  select count(*) into v_count from public.catalog_cards where catalog_set_id = p_catalog_set_id;
  if v_count = 0 then
    raise exception 'set % has no cards or is not visible', p_catalog_set_id using errcode = 'P0002';
  end if;
  if v_count <> cardinality(p_card_ids)
     or v_count <> (select count(distinct x) from unnest(p_card_ids) as x)
     or exists (select 1 from unnest(p_card_ids) as x where not exists (select 1 from public.catalog_cards c where c.id = x and c.catalog_set_id = p_catalog_set_id)) then
    raise exception 'p_card_ids must list every card of the set exactly once' using errcode = '22023';
  end if;
  update public.catalog_cards c
  set position = o.ord - 1
  from unnest(p_card_ids) with ordinality as o(id, ord)
  where c.id = o.id;
  get diagnostics v_updated = row_count;
  if v_updated <> v_count then
    raise exception 'not allowed to reorder this set' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.reorder_catalog_cards(uuid, uuid[]) from public, anon;
grant  execute on function public.reorder_catalog_cards(uuid, uuid[]) to authenticated;
