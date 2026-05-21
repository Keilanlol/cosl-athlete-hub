-- BF-ATH-004 — Photo officielle athlète
-- 1 seule photo d'identité par athlète, accès rapide via athletes.photo_url

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Unicité du document photo_identite par athlète
CREATE UNIQUE INDEX IF NOT EXISTS idx_athlete_photo_unique
  ON public.athlete_documents (athlete_id)
  WHERE doc_type = 'photo_identite';
