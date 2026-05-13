-- ============================================================================
-- COSLxBloobiz — Migration 07 : Agenda / rendez-vous par athlète
-- À appliquer sur l'instance Supabase self-hosted (psql -f 07_athlete_appointments.sql).
-- Texte libre uniquement, aucun lien typé.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.athlete_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_athlete_appointments_athlete
  ON public.athlete_appointments(athlete_id, starts_at DESC);

ALTER TABLE public.athlete_appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'athlete_appointments_all'
      AND tablename = 'athlete_appointments'
  ) THEN
    CREATE POLICY athlete_appointments_all ON public.athlete_appointments
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_appointments TO authenticated;
