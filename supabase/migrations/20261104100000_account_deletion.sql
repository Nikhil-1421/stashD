-- 0002: account deletion
--
-- Lets a signed-in user delete their own account. Deleting the auth.users row cascades to
-- public.profiles today and to every future user-owned table (all of them reference
-- auth.users or profiles with ON DELETE CASCADE). Nothing is soft-deleted; the data is gone.
--
-- SECURITY DEFINER is required because the `authenticated` role has no privileges on auth.users.
-- The function can only ever delete the caller (auth.uid()); it takes no arguments on purpose.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'delete_own_account() requires an authenticated user' using errcode = '42501';
  end if;

  delete from auth.users where id = caller;
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user''s auth.users row; all owned data cascades. Irreversible.';

revoke execute on function public.delete_own_account() from public, anon;
grant  execute on function public.delete_own_account() to authenticated;
