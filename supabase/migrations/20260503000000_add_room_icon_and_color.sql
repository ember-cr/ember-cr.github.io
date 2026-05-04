-- Add icon and color columns to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS icon text DEFAULT '#';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS color text DEFAULT 'sunset';
