-- pgTAP: catalog isolation + integrity. Run with `npm run db:test` (local stack).
begin;
select plan(12);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'alice@example.com', 'authenticated', 'authenticated', 'x', now(), '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   'authenticated', 'authenticated', 'x', now(), '{}', now(), now());

-- A shared provider set, as ingestion would create it.
insert into public.catalog_sets (id, provider_id, provider_set_id, name)
values ('10000000-0000-0000-0000-000000000001', (select id from public.catalog_providers where slug = 'tcgdex'), 'base1', 'Base Set');

-- Alice creates a custom set through the RPC.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.create_custom_set('Alice Custom', null, 'AC', null, null, 'en', null, 'Base') $$, 'owner can create a custom set');
select is((select count(*) from public.user_set_overview), 1::bigint, 'overview shows the new tracked set');
select is((select variant_count from public.user_set_overview), 1::bigint, 'a default Base variant was created');

-- Adding a card auto-creates its Base printing.
insert into public.catalog_cards (catalog_set_id, name, number)
select catalog_set_id, 'Pikachu', '25' from public.user_sets limit 1;
select is((select count(*) from public.card_printings), 1::bigint, 'new card gets a printing for the default variant');
select is((select owner_id from public.catalog_cards limit 1), '00000000-0000-0000-0000-000000000001'::uuid, 'card owner mirrors the set owner');

-- Alice cannot add a card to the shared provider set (owner would be null → with check fails).
select throws_ok(
  $$ insert into public.catalog_cards (catalog_set_id, name) values ('10000000-0000-0000-0000-000000000001', 'Nope') $$,
  '42501', null, 'users cannot write to provider sets');

-- Bob sees the shared set but none of Alice's rows.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.catalog_sets), 1::bigint, 'other users see only shared sets');
select is((select count(*) from public.catalog_cards), 0::bigint, 'other users see no custom cards');
select is((select count(*) from public.user_set_overview), 0::bigint, 'other users have no tracked sets');
select throws_ok(
  $$ insert into public.catalog_cards (catalog_set_id, name) select id, 'Hijack' from public.catalog_sets where name = 'Alice Custom' $$,
  '42501', null, 'other users cannot insert into a custom set they cannot see');
select throws_ok(
  $$ insert into public.catalog_cards (catalog_set_id, name) values ((select catalog_set_id from public.user_sets limit 1), 'Hijack') $$,
  '42501', null, 'direct id guessing is refused by the owner-sync trigger');

-- Sort key sanity.
reset role;
select ok(public.card_number_sort_key('2') < public.card_number_sort_key('10') and public.card_number_sort_key('10') < public.card_number_sort_key('TG01'),
  'card_number_sort_key orders numerically before alphabetically');

select * from finish();
rollback;
