-- Enable pgcrypto for bcrypt hashing
create extension if not exists pgcrypto with schema extensions;

-- Optional password on rooms (bcrypt hash; null = no password)
alter table public.rooms
  add column if not exists password_hash text;

-- Helper: does this room require a password?
create or replace function public.room_requires_password(_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _hash text;
  _trimmed text := trim(_code);
begin
  select password_hash into _hash
  from public.rooms
  where invite_code = _trimmed or short_code = _trimmed
  limit 1;
  if not found then
    raise exception 'Invalid invite code';
  end if;
  return _hash is not null;
end;
$$;

-- Owner sets/changes/clears the room password
create or replace function public.set_room_password(_room_id uuid, _new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_room_owner(_room_id, _uid) then
    raise exception 'Only the owner can change the password';
  end if;

  if _new_password is null or length(trim(_new_password)) = 0 then
    update public.rooms set password_hash = null where id = _room_id;
  else
    if length(_new_password) < 4 then
      raise exception 'Password must be at least 4 characters';
    end if;
    update public.rooms
    set password_hash = extensions.crypt(_new_password, extensions.gen_salt('bf'))
    where id = _room_id;
  end if;
end;
$$;

-- Replace join_room_by_code to accept and verify an optional password.
-- Owners can always join their own room without a password.
create or replace function public.join_room_by_code(_code text, _password text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _room_id uuid;
  _owner_id uuid;
  _hash text;
  _uid uuid := auth.uid();
  _trimmed text := trim(_code);
begin
  if _uid is null then raise exception 'Not authenticated'; end if;

  select id, owner_id, password_hash
    into _room_id, _owner_id, _hash
  from public.rooms
  where invite_code = _trimmed or short_code = _trimmed
  limit 1;

  if _room_id is null then
    raise exception 'Invalid invite code';
  end if;

  -- If a password is set and the joiner is not the owner and not already a member, verify it
  if _hash is not null
     and _uid <> _owner_id
     and not public.is_room_member(_room_id, _uid) then
    if _password is null or length(_password) = 0 then
      raise exception 'Password required';
    end if;
    if extensions.crypt(_password, _hash) <> _hash then
      raise exception 'Incorrect password';
    end if;
  end if;

  insert into public.room_members (room_id, user_id)
  values (_room_id, _uid)
  on conflict do nothing;

  return _room_id;
end;
$$;