-- pgTAP: publishing, library visibility, tracking rules, duplication. Run with `npm run db:test`.
begin;
select plan(12);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'alice@example.com', 'authenticated', 'authenticated', 'x', now(), '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   'authenticated', 'authenticated', 'x', now(), '{}', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.create_custom_set('Alice Set', null, 'AS', null, null, 'en', null, 'Base');
create temporary table cs as select catalog_set_id from public.user_sets limit 1;
insert into public.catalog_cards (catalog_set_id, name, number) select catalog_set_id, n, n from cs, unnest(array['1', '2']) as n;

-- Bob: private set is invisible and cannot be tracked.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.checklist_library), 0::bigint, 'private sets are not in the library');
select is((select count(*) from public.catalog_cards), 0::bigint, 'private cards are invisible to others');
select throws_ok($$ select public.track_catalog_set((select catalog_set_id from cs)) $$, '42501', null, 'a private set cannot be tracked by others');
select throws_ok($$ select public.set_catalog_set_visibility((select catalog_set_id from cs), 'public') $$, '42501', null, 'only the owner can publish');

-- Alice publishes.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.set_catalog_set_visibility((select catalog_set_id from cs), 'public'), 'public', 'owner publishes');

-- Bob: sees it, tracks it, reads its cards, copies it.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select card_count from public.checklist_library), 2::bigint, 'published set is listed with counts');
select lives_ok($$ select public.track_catalog_set((select catalog_set_id from cs)) $$, 'a public set can be tracked');
select is((select count(*) from public.catalog_cards where catalog_set_id = (select catalog_set_id from cs)), 2::bigint, 'tracker reads the cards');
create temporary table dup as select public.duplicate_catalog_set((select catalog_set_id from cs), 'My copy') as user_set_id;
select is((select count(*) from public.catalog_cards c join public.user_sets us on us.catalog_set_id = c.catalog_set_id where us.id = (select user_set_id from dup) and c.owner_id = '00000000-0000-0000-0000-000000000002'), 2::bigint, 'duplicate copies the cards into an owned set');
select is((select count(*) from public.card_printings p join public.catalog_cards c on c.id = p.catalog_card_id join public.user_sets us on us.catalog_set_id = c.catalog_set_id where us.id = (select user_set_id from dup)), 2::bigint, 'duplicate copies the printings');

-- Alice unpublishes: Bob keeps access because he tracks it; a stranger would not.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.set_catalog_set_visibility((select catalog_set_id from cs), 'private');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.checklist_library), 0::bigint, 'unpublished set leaves the library');
select is((select count(*) from public.catalog_cards where catalog_set_id = (select catalog_set_id from cs)), 2::bigint, 'an existing tracker keeps reading an unpublished set');

select * from finish();
rollback;
