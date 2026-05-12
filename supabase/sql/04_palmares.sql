-- ============================================================================
-- COSLxBloobiz — Migration 04 : Palmarès, épreuves, disciplines secondaires
-- À appliquer sur l'instance Supabase self-hosted (psql -f 04_palmares.sql).
-- ============================================================================

-- 1. Épreuves spécifiques d'un Games (BF-GAM-010 à 014)
CREATE TABLE IF NOT EXISTS public.game_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id),
  discipline_id uuid REFERENCES public.disciplines(id),
  name text NOT NULL,
  competition_date date,
  round text,
  gender text CHECK (gender IN ('male','female','mixed')),
  category text,
  venue text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_competitions_game ON public.game_competitions(game_id);

-- 2. Palmarès / résultats par athlète (Annexe B.2 hors MVP)
CREATE TABLE IF NOT EXISTS public.athlete_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id),
  game_competition_id uuid REFERENCES public.game_competitions(id),
  sport_id uuid REFERENCES public.sports(id),
  discipline_id uuid REFERENCES public.disciplines(id),
  result_date date,
  rank integer,
  medal text CHECK (medal IN ('gold','silver','bronze')),
  score text,
  unit text,
  is_national_record boolean NOT NULL DEFAULT false,
  is_personal_best boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_athlete_results_athlete ON public.athlete_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_results_game ON public.athlete_results(game_id);

-- 3. Disciplines secondaires de l'athlète (BF-ATH-013)
CREATE TABLE IF NOT EXISTS public.athlete_disciplines (
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  discipline_id uuid REFERENCES public.disciplines(id) ON DELETE CASCADE,
  PRIMARY KEY (athlete_id, discipline_id)
);

-- 4. RLS — même politique que les autres tables (tout authenticated)
ALTER TABLE public.game_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_disciplines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'game_competitions_all' AND tablename = 'game_competitions') THEN
    CREATE POLICY game_competitions_all ON public.game_competitions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'athlete_results_all' AND tablename = 'athlete_results') THEN
    CREATE POLICY athlete_results_all ON public.athlete_results
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'athlete_disciplines_all' AND tablename = 'athlete_disciplines') THEN
    CREATE POLICY athlete_disciplines_all ON public.athlete_disciplines
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_disciplines TO authenticated;
