-- 0003: catalog layer + user sets
--
-- Catalog data (games, providers, sets, cards, variant definitions, printings) is shared and
-- distinct from user collection data. Provider-sourced rows have owner_id NULL and are readable by
-- everyone. User-created ("custom") sets and their children carry owner_id and are visible only to
-- that owner. user_sets links a user to a catalog set they track.
--
-- Invariants honoured here: catalog ≠ user data (1); card identity, printing/variant and user
-- tracking are separate rows (2); custom sets need no provider (3).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Natural sort key for card numbers: "SV012a" → "sv0000000012a", so "2" < "10" < "TG01".
-- IMMUTABLE so it can back a generated column. Mirrored in src/features/catalog/domain/cardNumber.ts.
-- ---------------------------------------------------------------------------
create or replace function public.card_number_sort_key(n text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  out_key text := '';
  m text[];
begin
  for m in select regexp_matches(lower(n), '(\D*)(\d*)', 'g') loop
    out_key := out_key || m[1] || case when m[2] = '' then '' else lpad(m[2], 10, '0') end;
  end loop;
  return out_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- games (reference data; public read; no user writes)
-- ---------------------------------------------------------------------------
create table public.games (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name       text not null check (char_length(name) between 1 and 80),
  metadata   jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy "games: public read" on public.games for select to anon, authenticated using (true);
grant select on public.games to anon, authenticated;
create trigger games_set_updated_at before update on public.games
  for each row execute function public.set_updated_at();

insert into public.games (slug, name) values
  ('pokemon',    'Pokémon'),
  ('magic',      'Magic: The Gathering'),
  ('yugioh',     'Yu-Gi-Oh!'),
  ('lorcana',    'Disney Lorcana'),
  ('one-piece',  'One Piece Card Game'),
  ('f1',         'Formula 1'),
  ('basketball', 'Basketball'),
  ('football',   'Football'),
  ('baseball',   'Baseball'),
  ('soccer',     'Soccer'),
  ('other',      'Other');

-- ---------------------------------------------------------------------------
-- catalog_providers (adapter registry; public read)
-- ---------------------------------------------------------------------------
create table public.catalog_providers (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 1 and 80),
  website_url text,
  terms_url   text,
  attribution text,
  status      text not null default 'planned' check (status in ('planned', 'active', 'deprecated', 'disabled')),
  metadata    jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.catalog_providers enable row level security;
create policy "catalog_providers: public read" on public.catalog_providers for select to anon, authenticated using (true);
grant select on public.catalog_providers to anon, authenticated;
create trigger catalog_providers_set_updated_at before update on public.catalog_providers
  for each row execute function public.set_updated_at();

insert into public.catalog_providers (slug, name, website_url, terms_url, attribution, status) values
  ('tcgdex',     'TCGdex',     'https://tcgdex.dev',                 'https://tcgdex.dev',                 'Card data from TCGdex. Pokémon and card images © The Pokémon Company / Nintendo / Creatures / GAME FREAK.', 'planned'),
  ('scryfall',   'Scryfall',   'https://scryfall.com',               'https://scryfall.com/docs/api',      'Card data and images from Scryfall. Magic: The Gathering © Wizards of the Coast. Unofficial Fan Content under the Fan Content Policy.', 'planned'),
  ('ygoprodeck', 'YGOPRODeck', 'https://ygoprodeck.com',             'https://ygoprodeck.com/api-guide/',  'Card data from YGOPRODeck. Yu-Gi-Oh! card text and images © 4K Media Inc. / Konami.', 'planned');

-- ---------------------------------------------------------------------------
-- catalog_sets
-- ---------------------------------------------------------------------------
create table public.catalog_sets (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid references public.games (id) on delete set null,
  provider_id     uuid references public.catalog_providers (id) on delete restrict,
  provider_set_id text,
  owner_id        uuid references public.profiles (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  set_code        text check (set_code is null or char_length(set_code) <= 20),
  series          text check (series is null or char_length(series) <= 120),
  release_date    date,
  language        text not null default 'en' check (char_length(language) between 2 and 10),
  description     text check (description is null or char_length(description) <= 2000),
  image_url       text check (image_url is null or char_length(image_url) <= 2048),
  metadata        jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A set is either provider-sourced (shared) or user-owned (custom), never both or neither.
  constraint catalog_sets_origin check (
       (provider_id is not null and provider_set_id is not null and owner_id is null)
    or (provider_id is null     and provider_set_id is null     and owner_id is not null)
  )
);
comment on table public.catalog_sets is 'Shared catalog sets (owner_id null) and private custom sets (owner_id set).';

create unique index catalog_sets_provider_key on public.catalog_sets (provider_id, provider_set_id) where provider_id is not null;
create index catalog_sets_owner_idx on public.catalog_sets (owner_id) where owner_id is not null;
create index catalog_sets_game_idx  on public.catalog_sets (game_id);

alter table public.catalog_sets enable row level security;
create policy "catalog_sets: shared or own read" on public.catalog_sets for select to anon, authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "catalog_sets: owner insert" on public.catalog_sets for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "catalog_sets: owner update" on public.catalog_sets for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "catalog_sets: owner delete" on public.catalog_sets for delete to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.catalog_sets to anon;
grant select, insert, update, delete on public.catalog_sets to authenticated;
create trigger catalog_sets_set_updated_at before update on public.catalog_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- catalog_cards
-- owner_id mirrors the parent set (kept by trigger) so policies stay simple and indexable.
-- ---------------------------------------------------------------------------
create table public.catalog_cards (
  id               uuid primary key default gen_random_uuid(),
  catalog_set_id   uuid not null references public.catalog_sets (id) on delete cascade,
  owner_id         uuid references public.profiles (id) on delete cascade,
  provider_card_id text,
  name             text not null check (char_length(name) between 1 and 200),
  number           text check (number is null or char_length(number) <= 30),
  sort_key         text generated always as (public.card_number_sort_key(number)) stored,
  rarity           text check (rarity is null or char_length(rarity) <= 60),
  artist           text check (artist is null or char_length(artist) <= 120),
  language         text check (language is null or char_length(language) between 2 and 10),
  image_url        text check (image_url is null or char_length(image_url) <= 2048),
  external_ids     jsonb not null default '{}'::jsonb check (jsonb_typeof(external_ids) = 'object'),
  metadata         jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column public.catalog_cards.sort_key is 'Natural-sort key derived from number; see card_number_sort_key().';

create unique index catalog_cards_provider_key on public.catalog_cards (catalog_set_id, provider_card_id) where provider_card_id is not null;
create index catalog_cards_set_order_idx on public.catalog_cards (catalog_set_id, sort_key, position);
create index catalog_cards_owner_idx     on public.catalog_cards (owner_id) where owner_id is not null;
create index catalog_cards_name_trgm_idx on public.catalog_cards using gin (name extensions.gin_trgm_ops);

alter table public.catalog_cards enable row level security;
create policy "catalog_cards: shared or own read" on public.catalog_cards for select to anon, authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "catalog_cards: owner insert" on public.catalog_cards for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "catalog_cards: owner update" on public.catalog_cards for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "catalog_cards: owner delete" on public.catalog_cards for delete to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.catalog_cards to anon;
grant select, insert, update, delete on public.catalog_cards to authenticated;
create trigger catalog_cards_set_updated_at before update on public.catalog_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- variant_definitions (per-set taxonomy: base, reverse holo, 1st edition, parallel name …)
-- ---------------------------------------------------------------------------
create table public.variant_definitions (
  id                 uuid primary key default gen_random_uuid(),
  catalog_set_id     uuid not null references public.catalog_sets (id) on delete cascade,
  owner_id           uuid references public.profiles (id) on delete cascade,
  slug               text not null check (slug ~ '^[a-z0-9-]{1,40}$'),
  name               text not null check (char_length(name) between 1 and 60),
  category           text not null default 'finish'
                     check (category in ('finish', 'edition', 'parallel', 'language', 'promo', 'rarity', 'other')),
  applies_by_default boolean not null default true,
  position           integer not null default 0,
  metadata           jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (catalog_set_id, slug)
);
comment on column public.variant_definitions.applies_by_default is 'When true, every new card in the set automatically gets a printing of this variant.';

create index variant_definitions_set_idx   on public.variant_definitions (catalog_set_id, position);
create index variant_definitions_owner_idx on public.variant_definitions (owner_id) where owner_id is not null;

alter table public.variant_definitions enable row level security;
create policy "variant_definitions: shared or own read" on public.variant_definitions for select to anon, authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "variant_definitions: owner insert" on public.variant_definitions for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "variant_definitions: owner update" on public.variant_definitions for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "variant_definitions: owner delete" on public.variant_definitions for delete to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.variant_definitions to anon;
grant select, insert, update, delete on public.variant_definitions to authenticated;
create trigger variant_definitions_set_updated_at before update on public.variant_definitions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- card_printings: "this card exists in this variant". Absence = the reference app's -1.
-- ---------------------------------------------------------------------------
create table public.card_printings (
  id                    uuid primary key default gen_random_uuid(),
  catalog_card_id       uuid not null references public.catalog_cards (id) on delete cascade,
  variant_definition_id uuid not null references public.variant_definitions (id) on delete cascade,
  owner_id              uuid references public.profiles (id) on delete cascade,
  provider_printing_id  text,
  image_url             text check (image_url is null or char_length(image_url) <= 2048),
  metadata              jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (catalog_card_id, variant_definition_id)
);

create index card_printings_variant_idx on public.card_printings (variant_definition_id);
create index card_printings_owner_idx   on public.card_printings (owner_id) where owner_id is not null;

alter table public.card_printings enable row level security;
create policy "card_printings: shared or own read" on public.card_printings for select to anon, authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "card_printings: owner insert" on public.card_printings for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "card_printings: owner update" on public.card_printings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "card_printings: owner delete" on public.card_printings for delete to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.card_printings to anon;
grant select, insert, update, delete on public.card_printings to authenticated;
create trigger card_printings_set_updated_at before update on public.card_printings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Owner mirroring + integrity triggers (run as the caller: RLS on the parent lookup means a user
-- cannot attach children to a set they cannot see).
-- ---------------------------------------------------------------------------
create or replace function public.catalog_child_sync_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_owner uuid;
  card_set uuid;
  variant_set uuid;
begin
  if tg_table_name in ('catalog_cards', 'variant_definitions') then
    select owner_id into parent_owner from public.catalog_sets where id = new.catalog_set_id;
    if not found then
      raise exception 'catalog set % not found or not accessible', new.catalog_set_id using errcode = '42501';
    end if;
  elsif tg_table_name = 'card_printings' then
    select owner_id, catalog_set_id into parent_owner, card_set from public.catalog_cards where id = new.catalog_card_id;
    if not found then
      raise exception 'catalog card % not found or not accessible', new.catalog_card_id using errcode = '42501';
    end if;
    select catalog_set_id into variant_set from public.variant_definitions where id = new.variant_definition_id;
    if not found or variant_set <> card_set then
      raise exception 'variant % does not belong to the card''s set', new.variant_definition_id using errcode = '23514';
    end if;
  end if;
  new.owner_id := parent_owner;
  return new;
end;
$$;

create trigger catalog_cards_sync_owner before insert or update of catalog_set_id on public.catalog_cards
  for each row execute function public.catalog_child_sync_owner();
create trigger variant_definitions_sync_owner before insert or update of catalog_set_id on public.variant_definitions
  for each row execute function public.catalog_child_sync_owner();
create trigger card_printings_sync_owner before insert or update of catalog_card_id, variant_definition_id on public.card_printings
  for each row execute function public.catalog_child_sync_owner();

-- New card → printings for every variant that applies by default.
create or replace function public.catalog_cards_create_default_printings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.card_printings (catalog_card_id, variant_definition_id)
  select new.id, v.id
  from public.variant_definitions v
  where v.catalog_set_id = new.catalog_set_id and v.applies_by_default
  on conflict do nothing;
  return new;
end;
$$;
create trigger catalog_cards_default_printings after insert on public.catalog_cards
  for each row execute function public.catalog_cards_create_default_printings();

-- New default variant → printings for every existing card in the set.
create or replace function public.variant_definitions_create_default_printings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.card_printings (catalog_card_id, variant_definition_id)
  select c.id, new.id
  from public.catalog_cards c
  where c.catalog_set_id = new.catalog_set_id
  on conflict do nothing;
  return new;
end;
$$;
create trigger variant_definitions_default_printings after insert on public.variant_definitions
  for each row when (new.applies_by_default) execute function public.variant_definitions_create_default_printings();

-- ---------------------------------------------------------------------------
-- user_sets: a user tracking a catalog set
-- ---------------------------------------------------------------------------
create table public.user_sets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  catalog_set_id uuid not null references public.catalog_sets (id) on delete cascade,
  tracking_name  text check (tracking_name is null or char_length(tracking_name) between 1 and 120),
  status         text not null default 'active' check (status in ('active', 'archived')),
  favorite       boolean not null default false,
  metadata       jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, catalog_set_id)
);
create index user_sets_user_idx on public.user_sets (user_id, status);

alter table public.user_sets enable row level security;
create policy "user_sets: owner select" on public.user_sets for select to authenticated using (user_id = (select auth.uid()));
create policy "user_sets: owner insert" on public.user_sets for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_sets: owner update" on public.user_sets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_sets: owner delete" on public.user_sets for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.user_sets to authenticated;
create trigger user_sets_set_updated_at before update on public.user_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_set_overview: one row per tracked set with the joined catalog fields and counts.
-- security_invoker so the underlying RLS applies to the caller.
-- ---------------------------------------------------------------------------
create view public.user_set_overview
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
  (select count(*) from public.variant_definitions v where v.catalog_set_id = cs.id)  as variant_count
from public.user_sets us
join public.catalog_sets cs on cs.id = us.catalog_set_id
left join public.games g on g.id = cs.game_id;

grant select on public.user_set_overview to authenticated;

-- ---------------------------------------------------------------------------
-- create_custom_set: catalog set + default "Base" variant + tracking row in one transaction.
-- SECURITY INVOKER: runs under the caller's RLS.
-- ---------------------------------------------------------------------------
create or replace function public.create_custom_set(
  p_name text,
  p_game_id uuid default null,
  p_set_code text default null,
  p_series text default null,
  p_release_date date default null,
  p_language text default 'en',
  p_description text default null,
  p_default_variant_name text default 'Base'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_set_id uuid;
  new_user_set_id uuid;
begin
  if caller is null then
    raise exception 'create_custom_set() requires an authenticated user' using errcode = '42501';
  end if;

  insert into public.catalog_sets (game_id, owner_id, name, set_code, series, release_date, language, description)
  values (p_game_id, caller, p_name, nullif(p_set_code, ''), nullif(p_series, ''), p_release_date,
          coalesce(nullif(p_language, ''), 'en'), nullif(p_description, ''))
  returning id into new_set_id;

  insert into public.variant_definitions (catalog_set_id, slug, name, category, applies_by_default, position)
  values (new_set_id, 'base', coalesce(nullif(p_default_variant_name, ''), 'Base'), 'finish', true, 0);

  insert into public.user_sets (user_id, catalog_set_id)
  values (caller, new_set_id)
  returning id into new_user_set_id;

  return new_user_set_id;
end;
$$;

revoke execute on function public.create_custom_set(text, uuid, text, text, date, text, text, text) from public, anon;
grant  execute on function public.create_custom_set(text, uuid, text, text, date, text, text, text) to authenticated;
