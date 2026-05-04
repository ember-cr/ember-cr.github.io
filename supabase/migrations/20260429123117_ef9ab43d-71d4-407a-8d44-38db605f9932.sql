-- Clean up child rows when a room is deleted (no FKs exist, so use a trigger)
create or replace function public.cleanup_room_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.messages where room_id = old.id;
  delete from public.room_members where room_id = old.id;
  delete from public.email_invites where room_id = old.id;
  return old;
end;
$$;

drop trigger if exists rooms_before_delete_cleanup on public.rooms;
create trigger rooms_before_delete_cleanup
before delete on public.rooms
for each row execute function public.cleanup_room_children();