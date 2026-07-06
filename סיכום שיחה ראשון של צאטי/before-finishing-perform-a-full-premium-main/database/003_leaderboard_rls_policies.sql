-- Production RLS policies for public.leaderboard_entries.
-- Run after database/002_leaderboard_schema.sql.
--
-- Security model:
-- - Public users can read visible leaderboard entries.
-- - Authenticated users can read visible entries and their own entry.
-- - Regular authenticated users cannot directly insert/delete leaderboard rows.
-- - Regular authenticated users can update only safe profile fields on their own row.
-- - Score writes must happen through a trusted server-side API using service_role,
--   or a future SECURITY DEFINER RPC that validates the game result.
-- - Admins and service_role can manage entries.

alter table public.leaderboard_entries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leaderboard_entries_value_bounds_chk'
      and conrelid = 'public.leaderboard_entries'::regclass
  ) then
    alter table public.leaderboard_entries
      add constraint leaderboard_entries_value_bounds_chk
      check (
        char_length(trim(nickname)) between 3 and 20
        and char_length(trim(nickname_key)) between 3 and 80
        and best_prize >= 0
        and best_prize <= 1000000
        and best_correct_count >= 0
        and best_correct_count <= 15
        and games_count >= 0
      )
      not valid;
  end if;
end $$;

create or replace function public.is_leaderboard_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or exists (
      select 1
      from public.admins admin_user
      where admin_user.auth_user_id = auth.uid()::text
        and admin_user.is_active = true
    );
$$;

revoke all on function public.is_leaderboard_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_leaderboard_admin() to authenticated, service_role;

create or replace function public.leaderboard_entries_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_nickname text;
begin
  normalized_nickname := regexp_replace(trim(coalesce(new.nickname, '')), '\s+', ' ', 'g');

  if char_length(normalized_nickname) < 3 or char_length(normalized_nickname) > 20 then
    raise exception 'Nickname must be 3-20 characters.'
      using errcode = '23514';
  end if;

  new.nickname := normalized_nickname;
  new.nickname_key := lower(normalized_nickname);
  new.updated_at := now();

  if coalesce(auth.role(), '') = 'service_role' or public.is_leaderboard_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required for leaderboard changes.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Regular users cannot directly insert leaderboard score entries.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if old.auth_user_id is distinct from auth.uid()::text then
      raise exception 'Users can update only their own leaderboard profile fields.'
        using errcode = '42501';
    end if;

    if new.id is distinct from old.id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.best_prize is distinct from old.best_prize
       or new.best_correct_count is distinct from old.best_correct_count
       or new.games_count is distinct from old.games_count
       or new.is_hidden is distinct from old.is_hidden
       or new.created_at is distinct from old.created_at
    then
      raise exception 'Protected leaderboard fields cannot be changed by regular users.'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Regular users cannot delete leaderboard entries.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists leaderboard_entries_before_write_trigger on public.leaderboard_entries;

create trigger leaderboard_entries_before_write_trigger
before insert or update on public.leaderboard_entries
for each row
execute function public.leaderboard_entries_before_write();

drop policy if exists "leaderboard_public_read" on public.leaderboard_entries;
drop policy if exists "leaderboard_owner_read" on public.leaderboard_entries;
drop policy if exists "leaderboard_owner_safe_profile_update" on public.leaderboard_entries;
drop policy if exists "leaderboard_admin_all" on public.leaderboard_entries;
drop policy if exists "leaderboard_service_role_all" on public.leaderboard_entries;

create policy "leaderboard_public_read"
on public.leaderboard_entries
for select
to anon, authenticated
using (is_hidden = false);

create policy "leaderboard_owner_read"
on public.leaderboard_entries
for select
to authenticated
using (auth_user_id = auth.uid()::text);

create policy "leaderboard_owner_safe_profile_update"
on public.leaderboard_entries
for update
to authenticated
using (auth_user_id = auth.uid()::text)
with check (auth_user_id = auth.uid()::text);

create policy "leaderboard_admin_all"
on public.leaderboard_entries
for all
to authenticated
using (public.is_leaderboard_admin())
with check (public.is_leaderboard_admin());

create policy "leaderboard_service_role_all"
on public.leaderboard_entries
for all
to service_role
using (true)
with check (true);

revoke all on public.leaderboard_entries from public;
revoke all on public.leaderboard_entries from anon;
revoke all on public.leaderboard_entries from authenticated;

grant select on public.leaderboard_entries to anon;
grant select, update on public.leaderboard_entries to authenticated;
grant insert, delete on public.leaderboard_entries to authenticated;
grant all on public.leaderboard_entries to service_role;
