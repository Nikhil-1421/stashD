-- pgTAP: import_checklist() behaviour. Run with `npm run db:test` (local stack).
begin;
select plan(11);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'alice@example.com', 'authenticated', 'authenticated', 'x', now(), '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   'authenticated', 'authenticated', 'x', now(), '{}', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.create_custom_set('Alice Set', null, 'AS', null, null, 'en', null, 'Base');

create temporary table t as select catalog_set_id as set_id from public.user_sets limit 1;

-- First import: two cards, one named variant.
select is(
  (select public.import_checklist((select set_id from t), 'paste', 'skip',
    '[{"name":"Bulbasaur","number":"001","variants":["reverse-holo"]},{"name":"Ivysaur","number":"002","variants":[]}]',
    '[{"slug":"reverse-holo","name":"Reverse Holo"}]') - 'job_id'),
  '{"created":2,"updated":0,"skipped":0,"printings":1,"variants":1}'::jsonb,
  'creates cards, the variant and the named printing');
select is((select count(*) from public.card_printings), 3::bigint, 'two Base printings (trigger) + one Reverse Holo');
select is((select applies_by_default from public.variant_definitions where slug = 'reverse-holo'), false, 'imported variants are not default');
select is((select count(*) from public.checklist_import_jobs), 1::bigint, 'a job row is recorded');

-- Second import with skip: existing card untouched, new printing still added.
select is(
  (select public.import_checklist((select set_id from t), 'csv', 'skip',
    format('[{"name":"Bulbasaur RENAMED","number":"001","rarity":"Rare","variants":["reverse-holo"],"existing_id":"%s"}]',
           (select id from public.catalog_cards where number = '001'))::jsonb) - 'job_id'),
  '{"created":0,"updated":0,"skipped":1,"printings":0,"variants":0}'::jsonb,
  'skip leaves the matched card alone');
select is((select name from public.catalog_cards where number = '001'), 'Bulbasaur', 'name unchanged after skip');

-- Update strategy fills fields.
select public.import_checklist((select set_id from t), 'csv', 'update',
  format('[{"name":"Bulbasaur","number":"001","rarity":"Rare","existing_id":"%s"}]', (select id from public.catalog_cards where number = '001'))::jsonb);
select is((select rarity from public.catalog_cards where number = '001'), 'Rare', 'update fills rarity');

-- Create strategy duplicates.
select public.import_checklist((select set_id from t), 'json', 'create',
  format('[{"name":"Bulbasaur","number":"001","existing_id":"%s"}]', (select id from public.catalog_cards where number = '001' limit 1))::jsonb);
select is((select count(*) from public.catalog_cards where number = '001'), 2::bigint, 'create strategy inserts a duplicate');

-- Validation.
select throws_ok($$ select public.import_checklist((select set_id from t), 'csv', 'merge', '[]') $$, '22023', null, 'unknown strategy rejected');
select throws_ok($$ select public.import_checklist((select set_id from t), 'csv', 'skip', '[]') $$, '22023', null, 'empty import rejected');

-- Bob cannot import into Alice's set.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select public.import_checklist((select set_id from t), 'csv', 'skip', '[{"name":"Hijack"}]') $$, '42501', null, 'other users cannot import into a set they do not own');

select * from finish();
rollback;
