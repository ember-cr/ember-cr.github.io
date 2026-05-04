
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ROOMS
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique default encode(gen_random_bytes(9), 'base64'),
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;

-- ROOM MEMBERS
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.room_members enable row level security;

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index on public.messages (room_id, created_at);

-- EMAIL INVITES
create table public.email_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, email)
);
alter table public.email_invites enable row level security;

-- SECURITY DEFINER helper to avoid recursive RLS on room_members
create or replace function public.is_room_member(_room_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = _room_id and user_id = _user_id
  )
$$;

create or replace function public.is_room_owner(_room_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms
    where id = _room_id and owner_id = _user_id
  )
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-add owner as member of new room
create or replace function public.handle_new_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id)
  values (new.id, new.owner_id);
  return new;
end;
$$;

create trigger on_room_created
  after insert on public.rooms
  for each row execute function public.handle_new_room();

-- Auto-consume email invite when matching user joins
create or replace function public.consume_email_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
begin
  select email into user_email from auth.users where id = new.id;
  if user_email is not null then
    insert into public.room_members (room_id, user_id)
    select room_id, new.id from public.email_invites
    where lower(email) = lower(user_email)
    on conflict do nothing;
    delete from public.email_invites where lower(email) = lower(user_email);
  end if;
  return new;
end;
$$;

create trigger on_profile_created_consume_invites
  after insert on public.profiles
  for each row execute function public.consume_email_invites();

-- =========== RLS POLICIES ===========

-- profiles
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- rooms
create policy "Members can view their rooms"
  on public.rooms for select to authenticated
  using (public.is_room_member(id, auth.uid()));
create policy "Anyone authenticated can look up by invite code"
  on public.rooms for select to authenticated using (true);
create policy "Authenticated users can create rooms"
  on public.rooms for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners can update their rooms"
  on public.rooms for update to authenticated using (auth.uid() = owner_id);
create policy "Owners can delete their rooms"
  on public.rooms for delete to authenticated using (auth.uid() = owner_id);

-- room_members
create policy "Members can view memberships of their rooms"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));
create policy "Users can join rooms themselves"
  on public.room_members for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can leave rooms; owners can remove members"
  on public.room_members for delete to authenticated
  using (auth.uid() = user_id or public.is_room_owner(room_id, auth.uid()));

-- messages
create policy "Members can view messages"
  on public.messages for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));
create policy "Members can send messages"
  on public.messages for insert to authenticated
  with check (auth.uid() = user_id and public.is_room_member(room_id, auth.uid()));
create policy "Senders can delete their own messages"
  on public.messages for delete to authenticated using (auth.uid() = user_id);

-- email_invites
create policy "Members can view invites for their rooms"
  on public.email_invites for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));
create policy "Owners can create invites"
  on public.email_invites for insert to authenticated
  with check (public.is_room_owner(room_id, auth.uid()) and auth.uid() = invited_by);
create policy "Owners can delete invites"
  on public.email_invites for delete to authenticated
  using (public.is_room_owner(room_id, auth.uid()));

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.room_members;
