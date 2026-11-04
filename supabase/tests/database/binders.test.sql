-- pgTAP: binders → pages → placements ownership, slot validation, resize remap. Run with `npm run db:test`.
begin;
select plan(13);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'alice@example.com', 'authenticated', 'authenticated', 'x', now(), '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   'authenticated', 'authenticated', 'x', now(), '{}', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- A set with three printings to place.
select public.create_custom_set('Alice Set', null, 'AS', null, null, 'en', null, 'Base');
insert into public.catalog_cards (catalog_set_id, name, number)
select catalog_set_id, n, n from public.user_sets, unnest(array['1', '2', '3']) as n;
create temporary table pr as select id as printing_id, row_number() over (order by id) as n from public.card_printings;

create temporary table b as select public.create_binder('Alice Binder', 2, 2, null, null, 2) as binder_id;
select is((select count(*) from public.binder_pages where binder_id = (select binder_id from b)), 2::bigint, 'create_binder makes the requested pages');
select is((select page_count from public.binder_overview), 2::bigint, 'overview counts pages');
create temporary table pg as select id as page_id from public.binder_pages where page_order = 0;

select lives_ok($$ insert into public.binder_placements (page_id, slot_index, printing_id) values ((select page_id from pg), 3, (select printing_id from pr where n = 1)) $$, 'slot 3 fits a 2x2 page');
select throws_ok($$ insert into public.binder_placements (page_id, slot_index, printing_id) values ((select page_id from pg), 4, (select printing_id from pr where n = 2)) $$, '23514', null, 'slot 4 does not fit a 2x2 page');
select lives_ok($$ insert into public.binder_placements (page_id, slot_index, printing_id) values ((select page_id from pg), 0, (select printing_id from pr where n = 1)) $$, 'the same printing may be placed twice');
select throws_ok($$ insert into public.binder_placements (page_id, slot_index, printing_id) values ((select page_id from pg), 0, (select printing_id from pr where n = 3)) $$, '23505', null, 'a slot holds one placement');
select throws_ok($$ update public.binder_pages set rows = 1 where id = (select page_id from pg) $$, '23514', null, 'shrinking under placements directly is refused');

-- Resize 2x2 → 3x3 keeps coordinates: slot 3 = (1,1) becomes slot 4.
select is(public.resize_binder_page((select page_id from pg), 3, 3), 0, 'growing drops nothing');
select is((select array_agg(slot_index order by slot_index) from public.binder_placements where page_id = (select page_id from pg)), array[0, 4], 'placements remapped by coordinate');
-- 3x3 → 1x3 drops row 1.
select is(public.resize_binder_page((select page_id from pg), 1, 3), 1, 'shrinking reports the dropped placement');
select is((select array_agg(slot_index) from public.binder_placements where page_id = (select page_id from pg)), array[0], 'only the fitting placement remains');

-- Bob sees nothing and cannot place into Alice's binder.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.binder_overview), 0::bigint, 'other users see no binders');
select throws_ok($$ insert into public.binder_placements (page_id, slot_index, printing_id) values ((select page_id from pg), 1, (select printing_id from pr where n = 2)) $$, '42501', null, 'other users cannot place into a binder they do not own');

select * from finish();
rollback;
