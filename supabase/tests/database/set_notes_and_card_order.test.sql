-- pgTAP: user_set_notes isolation, card_order, reorder_catalog_cards. Run with `npm run db:test`.
begin;
select plan(8);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'alice@example.com', 'authenticated', 'authenticated', 'x', now(), '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   'authenticated', 'authenticated', 'x', now(), '{}', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
create temporary table t as select public.create_custom_set('Alice Set', null, 'AS', null, null, 'en', null, 'Base') as user_set_id;
create temporary table cs as select catalog_set_id from public.user_sets limit 1;
insert into public.catalog_cards (catalog_set_id, name, number, position)
select catalog_set_id, n, n, 0 from cs, unnest(array['1', '2', '3']) as n;

select lives_ok($$ insert into public.user_set_notes (user_set_id, body) values ((select user_set_id from t), 'pulled a holo') $$, 'owner can add a note');
select is((select card_order from public.user_set_overview), 'number', 'default card order is by number');

select lives_ok($$ update public.catalog_sets set card_order = 'manual' where id = (select catalog_set_id from cs) $$, 'owner can switch to manual order');
create temporary table ids as select array_agg(id order by number desc) as reversed from public.catalog_cards where catalog_set_id = (select catalog_set_id from cs);
select lives_ok($$ select public.reorder_catalog_cards((select catalog_set_id from cs), (select reversed from ids)) $$, 'owner can reorder');
select is((select array_agg(number order by position) from public.catalog_cards where catalog_set_id = (select catalog_set_id from cs)), array['3', '2', '1'], 'positions follow the given order');
select throws_ok($$ select public.reorder_catalog_cards((select catalog_set_id from cs), (select reversed[1:2] from ids)) $$, '22023', null, 'a partial list is refused');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.user_set_notes), 0::bigint, 'other users see no notes');
select throws_ok($$ select public.reorder_catalog_cards((select catalog_set_id from cs), (select reversed from ids)) $$, 'P0002', null, 'other users cannot see or reorder the set');

select * from finish();
rollback;
