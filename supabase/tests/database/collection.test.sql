-- pgTAP: collection_items + user_set_requirements isolation and integrity. Run with `npm run db:test`.
begin;
select plan(9);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'alice@example.com', 'authenticated', 'authenticated', 'x', now(), '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   'authenticated', 'authenticated', 'x', now(), '{}', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
create temporary table t as select public.create_custom_set('Alice Set', null, 'AS', null, null, 'en', null, 'Base') as user_set_id;
insert into public.catalog_cards (catalog_set_id, name, number)
select catalog_set_id, 'Pikachu', '25' from public.user_sets limit 1;
create temporary table p as select id as printing_id from public.card_printings limit 1;

select lives_ok($$ select public.set_collection_item((select user_set_id from t), (select printing_id from p), 2, 'NM', null) $$, 'owner can mark a printing owned');
select is((select quantity from public.collection_items), 2, 'quantity stored');
select public.set_collection_item((select user_set_id from t), (select printing_id from p), 0, null, 'traded away');
select is((select condition from public.collection_items), 'NM', 'partial patch keeps condition');
select is((select notes from public.collection_items), 'traded away', 'partial patch sets notes');
select is((select owned_printings from public.user_set_overview), 0::bigint, 'overview counts only quantity > 0');

-- Requirement rule does not touch items.
insert into public.user_set_requirements (user_set_id, scope, target, action)
values ((select user_set_id from t), 'variant', (select variant_definition_id::text from public.card_printings limit 1), 'exclude');
select is((select count(*) from public.collection_items), 1::bigint, 'requirement changes never delete ownership');

-- A second set of Alice's cannot claim the first set's printing.
select public.create_custom_set('Other Set', null, 'OS', null, null, 'en', null, 'Base');
select throws_ok(
  $$ insert into public.collection_items (user_set_id, printing_id)
     select id, (select printing_id from p) from public.user_sets where tracking_name is null and catalog_set_id <> (select catalog_set_id from public.user_sets us join t on us.id = t.user_set_id) $$,
  '23514', null, 'printing must belong to the tracked set');

-- Bob sees nothing and cannot write.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.collection_items), 0::bigint, 'other users see no items');
select throws_ok(
  $$ insert into public.collection_items (user_set_id, printing_id) values ((select user_set_id from t), (select printing_id from p)) $$,
  '42501', null, 'other users cannot insert items into a set they do not own');

select * from finish();
rollback;
