DROP POLICY IF EXISTS "Members can view their rooms" ON public.rooms;
CREATE POLICY "Members or owner can view rooms"
ON public.rooms FOR SELECT
TO authenticated
USING (is_room_member(id, auth.uid()) OR auth.uid() = owner_id);