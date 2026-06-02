-- BF-IMG-001 — Logos & photos pour entités (fédérations, clubs, membres, encadrants)
-- Stockage : URL signée 1 an dans le bucket `documents`, chemin conservé pour suppression/remplacement.

ALTER TABLE public.federations
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT;

ALTER TABLE public.federation_members
  ADD COLUMN IF NOT EXISTS photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

NOTIFY pgrst, 'reload schema';
