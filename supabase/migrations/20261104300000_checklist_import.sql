-- 0004: checklist import
--
-- import_checklist() commits a reviewed import plan in one transaction: it upserts variant
-- definitions by slug, inserts or updates cards according to the chosen conflict strategy, adds the
-- printings each row names, and records a checklist_import_jobs row. SECURITY INVOKER, so every
-- write goes through the owner's RLS and the catalog_child_sync_owner() trigger.
--
-- Ownership columns (quantity, condition) are deliberately not written here (invariant 4; phase 4).

create table public.checklist_import_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  catalog_set_id uuid references public.catalog_sets (id) on delete set null,
  source         text not null check (source in ('paste', 'csv', 'tsv', 'json')),
  strategy       text not null check (strategy in ('skip', 'update', 'create')),
  status         text not null default 'committed' check (status in ('committed')),
  summary        jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at     timestamptz not null default now()
);
comment on table public.checklist_import_jobs is 'One row per committed checklist import; raw uploads are never stored.';
create index checklist_import_jobs_user_idx on public.checklist_import_jobs (user_id, created_at desc);
create index checklist_import_jobs_set_idx  on public.checklist_import_jobs (catalog_set_id);

alter table public.checklist_import_jobs enable row level security;
create policy "checklist_import_jobs: owner select" on public.checklist_import_jobs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "checklist_import_jobs: owner insert" on public.checklist_import_jobs for insert to authenticated
  with check (user_id = (select auth.uid()));
grant select, insert on public.checklist_import_jobs to authenticated;
revoke all on public.checklist_import_jobs from anon;

-- ---------------------------------------------------------------------------
-- import_checklist(set, source, strategy, cards, variants) → summary
--   cards:    [{ name, number, rarity, artist, language, external_id, variants: [slug], existing_id }]
--   variants: [{ slug, name }]   (created with applies_by_default = false when missing)
-- ---------------------------------------------------------------------------
create or replace function public.import_checklist(
  p_catalog_set_id uuid,
  p_source text,
  p_strategy text,
  p_cards jsonb,
  p_variants jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  set_owner uuid;
  v jsonb;
  c jsonb;
  card_id uuid;
  existing_id uuid;
  v_slug text;
  next_position integer;
  n_created integer := 0;
  n_updated integer := 0;
  n_skipped integer := 0;
  n_printings integer := 0;
  n_variants integer := 0;
  n_rows integer;
  job_id uuid;
begin
  if caller is null then
    raise exception 'import_checklist() requires an authenticated user' using errcode = '42501';
  end if;
  if p_strategy not in ('skip', 'update', 'create') then
    raise exception 'unknown conflict strategy %', p_strategy using errcode = '22023';
  end if;
  if p_source not in ('paste', 'csv', 'tsv', 'json') then
    raise exception 'unknown import source %', p_source using errcode = '22023';
  end if;
  if jsonb_typeof(p_cards) <> 'array' or jsonb_typeof(p_variants) <> 'array' then
    raise exception 'p_cards and p_variants must be JSON arrays' using errcode = '22023';
  end if;
  n_rows := jsonb_array_length(p_cards);
  if n_rows = 0 then
    raise exception 'nothing to import' using errcode = '22023';
  end if;
  if n_rows > 5000 then
    raise exception 'imports are limited to 5000 cards at a time' using errcode = '22023';
  end if;

  -- RLS hides sets the caller cannot see; the owner check refuses shared (provider) sets.
  select owner_id into set_owner from public.catalog_sets where id = p_catalog_set_id;
  if not found or set_owner is distinct from caller then
    raise exception 'catalog set % is not yours to import into', p_catalog_set_id using errcode = '42501';
  end if;

  -- Variants: create any missing slug (non-default so existing cards stay as they are).
  select coalesce(max(position), -1) + 1 into next_position
  from public.variant_definitions where catalog_set_id = p_catalog_set_id;
  for v in select * from jsonb_array_elements(p_variants) loop
    v_slug := v->>'slug';
    if v_slug is null or v_slug !~ '^[a-z0-9-]{1,40}$' then
      raise exception 'invalid variant slug %', v_slug using errcode = '22023';
    end if;
    insert into public.variant_definitions (catalog_set_id, slug, name, category, applies_by_default, position)
    values (p_catalog_set_id, v_slug, coalesce(nullif(v->>'name', ''), v_slug), 'finish', false, next_position)
    on conflict (catalog_set_id, slug) do nothing;
    if found then
      n_variants := n_variants + 1;
      next_position := next_position + 1;
    end if;
  end loop;

  -- Cards.
  select coalesce(max(position), -1) + 1 into next_position
  from public.catalog_cards where catalog_set_id = p_catalog_set_id;
  for c in select * from jsonb_array_elements(p_cards) loop
    if coalesce(c->>'name', '') = '' then
      raise exception 'every card needs a name' using errcode = '22023';
    end if;
    existing_id := (c->>'existing_id')::uuid;
    card_id := null;

    if existing_id is not null and p_strategy <> 'create' then
      -- Re-check under RLS that the match is a card of this set; a stale/foreign id becomes "new".
      select id into card_id from public.catalog_cards where id = existing_id and catalog_set_id = p_catalog_set_id;
    end if;

    if card_id is not null then
      if p_strategy = 'update' then
        update public.catalog_cards
        set name        = c->>'name',
            number      = coalesce(nullif(c->>'number', ''), number),
            rarity      = coalesce(nullif(c->>'rarity', ''), rarity),
            artist      = coalesce(nullif(c->>'artist', ''), artist),
            language    = coalesce(nullif(c->>'language', ''), language),
            external_ids = case when nullif(c->>'external_id', '') is null then external_ids
                                else external_ids || jsonb_build_object('import', c->>'external_id') end
        where id = card_id;
        n_updated := n_updated + 1;
      else
        n_skipped := n_skipped + 1;
      end if;
    else
      insert into public.catalog_cards (catalog_set_id, name, number, rarity, artist, language, external_ids, position)
      values (
        p_catalog_set_id,
        c->>'name',
        nullif(c->>'number', ''),
        nullif(c->>'rarity', ''),
        nullif(c->>'artist', ''),
        nullif(c->>'language', ''),
        case when nullif(c->>'external_id', '') is null then '{}'::jsonb else jsonb_build_object('import', c->>'external_id') end,
        next_position
      )
      returning id into card_id;
      next_position := next_position + 1;
      n_created := n_created + 1;
    end if;

    -- Printings named by the file (default printings were created by the insert trigger).
    if jsonb_typeof(c->'variants') = 'array' then
      insert into public.card_printings (catalog_card_id, variant_definition_id)
      select card_id, vd.id
      from jsonb_array_elements_text(c->'variants') as s(variant_slug)
      join public.variant_definitions vd on vd.catalog_set_id = p_catalog_set_id and vd.slug = s.variant_slug
      on conflict (catalog_card_id, variant_definition_id) do nothing;
      get diagnostics n_rows = row_count;
      n_printings := n_printings + n_rows;
    end if;
  end loop;

  insert into public.checklist_import_jobs (user_id, catalog_set_id, source, strategy, summary)
  values (caller, p_catalog_set_id, p_source, p_strategy,
          jsonb_build_object('created', n_created, 'updated', n_updated, 'skipped', n_skipped,
                             'printings', n_printings, 'variants', n_variants))
  returning id into job_id;

  return jsonb_build_object('job_id', job_id, 'created', n_created, 'updated', n_updated, 'skipped', n_skipped,
                            'printings', n_printings, 'variants', n_variants);
end;
$$;

revoke execute on function public.import_checklist(uuid, text, text, jsonb, jsonb) from public, anon;
grant  execute on function public.import_checklist(uuid, text, text, jsonb, jsonb) to authenticated;
