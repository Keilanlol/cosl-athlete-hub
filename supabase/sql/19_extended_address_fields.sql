-- 19_extended_address_fields.sql
-- BF: Champs adresse séparés (street/postcode/city/country) sur :
--   athletes, club_members, federation_members, accommodations, game_competitions
-- Tolérant si certaines tables n'existent pas encore (exécuter d'abord 13_/14_).

DO $$
BEGIN
  IF to_regclass('public.athletes') IS NOT NULL THEN
    ALTER TABLE public.athletes
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.club_members') IS NOT NULL THEN
    ALTER TABLE public.club_members
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.federation_members') IS NOT NULL THEN
    ALTER TABLE public.federation_members
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.accommodations') IS NOT NULL THEN
    ALTER TABLE public.accommodations
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.game_competitions') IS NOT NULL THEN
    ALTER TABLE public.game_competitions
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
