-- ============================================================================
-- COSLxBloobiz — Migration 05 : Disciplines admises par sport d'un Games
-- À appliquer : psql -f 05_game_sport_disciplines.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_sport_disciplines (
  game_sport_id uuid NOT NULL REFERENCES public.game_sports(id) ON DELETE CASCADE,
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  PRIMARY KEY (game_sport_id, discipline_id)
);

CREATE INDEX IF NOT EXISTS idx_gsd_sport ON public.game_sport_disciplines(game_sport_id);

ALTER TABLE public.game_sport_disciplines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'game_sport_disciplines_all' AND tablename = 'game_sport_disciplines') THEN
    CREATE POLICY game_sport_disciplines_all ON public.game_sport_disciplines
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sport_disciplines TO authenticated;
