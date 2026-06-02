-- BF-IMG-002 — Photo pour les membres de club
-- Stockage : URL signée 1 an dans le bucket `documents`.

ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

NOTIFY pgrst, 'reload schema';
