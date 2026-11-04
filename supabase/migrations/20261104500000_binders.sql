-- 0007: binders, pages, placements
--
-- A binder is a user's physical organisation plan: ordered pages, each with its own rows × columns,
-- and sparse placements (one row per filled slot; an empty slot is the absence of a row).
-- A placement references a printing and never implies ownership (invariant 5); the same printing
-- may sit in several slots (invariant 7). Authorization derives from the binder owner through the
-- page, never from a user-supplied user_id on the child rows.
--
-- Slot addressing: slot_index = row * columns + col (0-based). Resizing a page remaps by
-- coordinate (resize_binder_page) so a card at (row 1, col 2) stays at (1, 2) when it still fits.

create table public.binders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  description      text check (description is null or char_length(description) <= 2000),
  cover_image_url  text check (cover_image_url is null or char_length(cover_image_url) <= 2048),
  game_id          uuid references public.games (id) on delete set null,
  default_rows     integer not null default 3 check (default_rows between 1 and 6),
  default_columns  integer not null default 3 check (default_columns between 1 and 6),
  notes            text check (notes is null or char_length(notes) <= 2000),
  metadata         jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.binders is 'Physical binder plan; pages and placements hang off it. Independent of ownership.';
create index binders_user_idx on public.binders (user_id);

alter table public.binders enable row level security;
create policy "binders: owner select" on public.binders for select to authenticated using (user_id = (select auth.uid()));
create policy "binders: owner insert" on public.binders for insert to authenticated with check (user_id = (select auth.uid()));
create policy "binders: owner update" on public.binders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "binders: owner delete" on public.binders for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.binders to authenticated;
revoke all on public.binders from anon;
create trigger binders_set_updated_at before update on public.binders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table public.binder_pages (
  id         uuid primary key default gen_random_uuid(),
  binder_id  uuid not null references public.binders (id) on delete cascade,
  page_order integer not null check (page_order >= 0),
  rows       integer not null check (rows between 1 and 6),
  columns    integer not null check (columns between 1 and 6),
  label      text check (label is null or char_length(label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deferred so a reorder can renumber every page in one transaction without transient clashes.
  constraint binder_pages_order_key unique (binder_id, page_order) deferrable initially deferred
);
comment on column public.binder_pages.page_order is '0-based position; gaps are allowed, order by it.';
create index binder_pages_binder_idx on public.binder_pages (binder_id, page_order);

alter table public.binder_pages enable row level security;
create policy "binder_pages: owner select" on public.binder_pages for select to authenticated
  using (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
create policy "binder_pages: owner insert" on public.binder_pages for insert to authenticated
  with check (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
create policy "binder_pages: owner update" on public.binder_pages for update to authenticated
  using (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
create policy "binder_pages: owner delete" on public.binder_pages for delete to authenticated
  using (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
grant select, insert, update, delete on public.binder_pages to authenticated;
revoke all on public.binder_pages from anon;
create trigger binder_pages_set_updated_at before update on public.binder_pages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table public.binder_placements (
  id                 uuid primary key default gen_random_uuid(),
  page_id            uuid not null references public.binder_pages (id) on delete cascade,
  slot_index         integer not null check (slot_index >= 0),
  printing_id        uuid not null references public.card_printings (id) on delete cascade,
  collection_item_id uuid references public.collection_items (id) on delete set null,
  notes              text check (notes is null or char_length(notes) <= 500),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Not deferrable: the client upserts on this key (ON CONFLICT cannot use a deferrable constraint).
  constraint binder_placements_slot_key unique (page_id, slot_index)
);
comment on table public.binder_placements is 'One row per filled slot. Empty slots have no row. Placement ≠ ownership.';
create index binder_placements_printing_idx on public.binder_placements (printing_id);

alter table public.binder_placements enable row level security;
create policy "binder_placements: owner select" on public.binder_placements for select to authenticated
  using (exists (select 1 from public.binder_pages p join public.binders b on b.id = p.binder_id where p.id = page_id and b.user_id = (select auth.uid())));
create policy "binder_placements: owner insert" on public.binder_placements for insert to authenticated
  with check (exists (select 1 from public.binder_pages p join public.binders b on b.id = p.binder_id where p.id = page_id and b.user_id = (select auth.uid())));
create policy "binder_placements: owner update" on public.binder_placements for update to authenticated
  using (exists (select 1 from public.binder_pages p join public.binders b on b.id = p.binder_id where p.id = page_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.binder_pages p join public.binders b on b.id = p.binder_id where p.id = page_id and b.user_id = (select auth.uid())));
create policy "binder_placements: owner delete" on public.binder_placements for delete to authenticated
  using (exists (select 1 from public.binder_pages p join public.binders b on b.id = p.binder_id where p.id = page_id and b.user_id = (select auth.uid())));
grant select, insert, update, delete on public.binder_placements to authenticated;
revoke all on public.binder_placements from anon;
create trigger binder_placements_set_updated_at before update on public.binder_placements
  for each row execute function public.set_updated_at();

-- A placement must fit its page (runs as caller; RLS applies).
create or replace function public.binder_placements_check_slot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_capacity integer;
begin
  select rows * columns into v_capacity from public.binder_pages where id = new.page_id;
  if v_capacity is null or new.slot_index >= v_capacity then
    raise exception 'slot % does not exist on page %', new.slot_index, new.page_id using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger binder_placements_check_slot before insert or update of page_id, slot_index on public.binder_placements
  for each row execute function public.binder_placements_check_slot();

-- Shrinking a page directly is refused while placements would fall outside; use resize_binder_page.
create or replace function public.binder_pages_check_fit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.binder_placements bp where bp.page_id = new.id and bp.slot_index >= new.rows * new.columns) then
    raise exception 'page % has placements outside % x %; use resize_binder_page', new.id, new.rows, new.columns using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger binder_pages_check_fit before update of rows, columns on public.binder_pages
  for each row execute function public.binder_pages_check_fit();

-- ---------------------------------------------------------------------------
-- create_binder: binder + its first pages in one transaction. Returns the binder id.
-- ---------------------------------------------------------------------------
create or replace function public.create_binder(
  p_name text,
  p_rows integer default 3,
  p_columns integer default 3,
  p_game_id uuid default null,
  p_description text default null,
  p_pages integer default 1
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_binder_id uuid;
begin
  if p_pages < 0 or p_pages > 50 then
    raise exception 'p_pages must be between 0 and 50' using errcode = '22023';
  end if;
  insert into public.binders (user_id, name, description, game_id, default_rows, default_columns)
  values ((select auth.uid()), p_name, nullif(p_description, ''), p_game_id, p_rows, p_columns)
  returning id into v_binder_id;
  insert into public.binder_pages (binder_id, page_order, rows, columns)
  select v_binder_id, g, p_rows, p_columns from generate_series(0, p_pages - 1) as g;
  return v_binder_id;
end;
$$;
revoke execute on function public.create_binder(text, integer, integer, uuid, text, integer) from public, anon;
grant  execute on function public.create_binder(text, integer, integer, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- resize_binder_page: coordinate-based remap. Placements whose (row, col) still fit keep their
-- coordinates (their slot_index changes with the column count); the rest are deleted. Returns the
-- number dropped. The client previews the drop list and asks for confirmation before calling this.
-- ---------------------------------------------------------------------------
create or replace function public.resize_binder_page(p_page_id uuid, p_rows integer, p_columns integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_old_columns integer;
  v_dropped integer;
begin
  select columns into v_old_columns from public.binder_pages where id = p_page_id for update;
  if v_old_columns is null then
    raise exception 'page % not found', p_page_id using errcode = 'P0002';
  end if;
  create temporary table resize_keep on commit drop as
  select bp.id, bp.printing_id, bp.collection_item_id, bp.notes, bp.created_at,
         (bp.slot_index / v_old_columns) * p_columns + (bp.slot_index % v_old_columns) as new_index
  from public.binder_placements bp
  where bp.page_id = p_page_id
    and (bp.slot_index / v_old_columns) < p_rows
    and (bp.slot_index % v_old_columns) < p_columns;
  select count(*) into v_dropped from public.binder_placements where page_id = p_page_id;
  v_dropped := v_dropped - (select count(*) from resize_keep);
  -- Delete and re-insert so the non-deferrable (page_id, slot_index) key never clashes mid-update.
  delete from public.binder_placements where page_id = p_page_id;
  update public.binder_pages set rows = p_rows, columns = p_columns where id = p_page_id;
  insert into public.binder_placements (id, page_id, slot_index, printing_id, collection_item_id, notes, created_at)
  select id, p_page_id, new_index, printing_id, collection_item_id, notes, created_at from resize_keep;
  return v_dropped;
end;
$$;
revoke execute on function public.resize_binder_page(uuid, integer, integer) from public, anon;
grant  execute on function public.resize_binder_page(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- reorder_binder_pages: p_page_ids must be exactly the binder's pages, in the wanted order.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_binder_pages(p_binder_id uuid, p_page_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.binder_pages where binder_id = p_binder_id;
  if v_count = 0 then
    raise exception 'binder % not found', p_binder_id using errcode = 'P0002';
  end if;
  if v_count <> cardinality(p_page_ids)
     or v_count <> (select count(distinct x) from unnest(p_page_ids) as x)
     or exists (select 1 from unnest(p_page_ids) as x where not exists (select 1 from public.binder_pages bp where bp.id = x and bp.binder_id = p_binder_id)) then
    raise exception 'p_page_ids must list every page of the binder exactly once' using errcode = '22023';
  end if;
  update public.binder_pages bp
  set page_order = o.ord - 1
  from unnest(p_page_ids) with ordinality as o(id, ord)
  where bp.id = o.id;
end;
$$;
revoke execute on function public.reorder_binder_pages(uuid, uuid[]) from public, anon;
grant  execute on function public.reorder_binder_pages(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- duplicate_binder_page: copy right after the source (later pages shift by one). Returns new id.
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_binder_page(p_page_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_src public.binder_pages;
  v_new_id uuid;
begin
  select * into v_src from public.binder_pages where id = p_page_id;
  if v_src.id is null then
    raise exception 'page % not found', p_page_id using errcode = 'P0002';
  end if;
  update public.binder_pages set page_order = page_order + 1 where binder_id = v_src.binder_id and page_order > v_src.page_order;
  insert into public.binder_pages (binder_id, page_order, rows, columns, label)
  values (v_src.binder_id, v_src.page_order + 1, v_src.rows, v_src.columns, v_src.label)
  returning id into v_new_id;
  insert into public.binder_placements (page_id, slot_index, printing_id, notes)
  select v_new_id, slot_index, printing_id, notes from public.binder_placements where page_id = p_page_id;
  return v_new_id;
end;
$$;
revoke execute on function public.duplicate_binder_page(uuid) from public, anon;
grant  execute on function public.duplicate_binder_page(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- generate_binder_pages: append pages filled with p_printing_ids in order (auto-layout).
-- Returns the number of pages created. Existing pages are never touched.
-- ---------------------------------------------------------------------------
create or replace function public.generate_binder_pages(p_binder_id uuid, p_printing_ids uuid[], p_rows integer, p_columns integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_capacity integer := p_rows * p_columns;
  v_total integer := cardinality(p_printing_ids);
  v_pages integer;
  v_start integer;
  v_page_id uuid;
  v_i integer;
begin
  if not exists (select 1 from public.binders where id = p_binder_id) then
    raise exception 'binder % not found', p_binder_id using errcode = 'P0002';
  end if;
  if v_total = 0 then
    return 0;
  end if;
  if v_total > 5000 then
    raise exception 'at most 5000 printings per generation' using errcode = '22023';
  end if;
  v_pages := ceil(v_total::numeric / v_capacity);
  select coalesce(max(page_order), -1) + 1 into v_start from public.binder_pages where binder_id = p_binder_id;
  for v_i in 0 .. v_pages - 1 loop
    insert into public.binder_pages (binder_id, page_order, rows, columns)
    values (p_binder_id, v_start + v_i, p_rows, p_columns)
    returning id into v_page_id;
    insert into public.binder_placements (page_id, slot_index, printing_id)
    select v_page_id, (o.ord - 1) - v_i * v_capacity, o.printing_id
    from unnest(p_printing_ids) with ordinality as o(printing_id, ord)
    where (o.ord - 1) / v_capacity = v_i;
  end loop;
  return v_pages;
end;
$$;
revoke execute on function public.generate_binder_pages(uuid, uuid[], integer, integer) from public, anon;
grant  execute on function public.generate_binder_pages(uuid, uuid[], integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- binder_overview: list-screen row with counts. security_invoker so RLS applies to the caller.
-- ---------------------------------------------------------------------------
create view public.binder_overview
with (security_invoker = true)
as
select
  b.id,
  b.user_id,
  b.name,
  b.description,
  b.cover_image_url,
  b.game_id,
  g.name as game_name,
  b.default_rows,
  b.default_columns,
  b.notes,
  b.created_at,
  b.updated_at,
  (select count(*) from public.binder_pages p where p.binder_id = b.id) as page_count,
  (select count(*) from public.binder_placements bp join public.binder_pages p on p.id = bp.page_id where p.binder_id = b.id) as placement_count,
  (select coalesce(sum(p.rows * p.columns), 0) from public.binder_pages p where p.binder_id = b.id) as slot_count
from public.binders b
left join public.games g on g.id = b.game_id;

grant select on public.binder_overview to authenticated;
revoke all on public.binder_overview from anon;
