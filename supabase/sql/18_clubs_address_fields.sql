-- 18_clubs_address_fields.sql
-- BF: Champs adresse séparés pour les clubs (street/postcode/country)
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS street   text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS country  text;
