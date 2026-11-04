-- pgTAP: profiles RLS isolation. Run with `npm run db:test` (requires Docker + `npm run db:start`).
begin;
select plan(7);

-- Two users created directly in auth.users; the trigger must create their profiles.
insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'alice@example.com', 'authenticated', 'authenticated', 'x', now(), '{"display_name":"Alice"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'bob@example.com',   'authenticated', 'authenticated', 'x', now(), '{}', now(), now());

select is((select count(*) from public.profiles), 2::bigint, 'trigger creates one profile per new user');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 'Alice', 'display_name is copied from sign-up metadata');

-- Act as Alice.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*) from public.profiles), 1::bigint, 'a user sees only their own profile');
select is((select id from public.profiles), '00000000-0000-0000-0000-000000000001'::uuid, 'the visible row is their own');

-- Alice cannot update Bob (0 rows affected, no error).
update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-000000000002';
reset role;
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'), null, 'cross-user update is silently filtered by RLS');

-- Alice cannot insert a profile for someone else.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000099') $$,
  '42501',
  null,
  'inserting a profile for another id violates RLS'
);

-- Anonymous callers see nothing.
set local role anon;
select throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  null,
  'anon has no privileges on profiles'
);

select * from finish();
rollback;
