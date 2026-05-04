
-- 1. Add short 6-digit code to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS short_code text;

CREATE OR REPLACE FUNCTION public.generate_room_short_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  c text;
  exists_already boolean;
BEGIN
  LOOP
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.rooms WHERE short_code = c) INTO exists_already;
    IF NOT exists_already THEN
      RETURN c;
    END IF;
  END LOOP;
END;
$$;

-- Backfill
UPDATE public.rooms SET short_code = public.generate_room_short_code() WHERE short_code IS NULL;

ALTER TABLE public.rooms ALTER COLUMN short_code SET NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN short_code SET DEFAULT public.generate_room_short_code();

CREATE UNIQUE INDEX IF NOT EXISTS rooms_short_code_unique ON public.rooms(short_code);

-- 2. Remove the overly-permissive SELECT policy that exposed all rooms
DROP POLICY IF EXISTS "Anyone authenticated can look up by invite code" ON public.rooms;

-- 3. RPC to join by code (handles both long invite_code and 6-digit short_code)
CREATE OR REPLACE FUNCTION public.join_room_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room_id uuid;
  _uid uuid;
  _trimmed text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _trimmed := trim(_code);

  SELECT id INTO _room_id
  FROM public.rooms
  WHERE invite_code = _trimmed OR short_code = _trimmed
  LIMIT 1;

  IF _room_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.room_members (room_id, user_id)
  VALUES (_room_id, _uid)
  ON CONFLICT DO NOTHING;

  RETURN _room_id;
END;
$$;
