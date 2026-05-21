-- 19_extended_address_fields.sql
-- BF: Champs adresse séparés (street/postcode/city/country) sur :
--   athletes, club_members, federation_members, accommodations, game_competitions

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS street   text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS city     text,
  ADD COLUMN IF NOT EXISTS country  text;

ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS street   text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS city     text,
  ADD COLUMN IF NOT EXISTS country  text;

ALTER TABLE public.federation_members
  ADD COLUMN IF NOT EXISTS street   text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS city     text,
  ADD COLUMN IF NOT EXISTS country  text;

ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS street   text,
  ADD COLUMN IF NOT EXISTS postcode text;

ALTER TABLE public.game_competitions
  ADD COLUMN IF NOT EXISTS street   text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS city     text,
  ADD COLUMN IF NOT EXISTS country  text;

NOTIFY pgrst, 'reload schema';
