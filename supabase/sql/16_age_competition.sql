-- BF-ATH-052 + BF-GAM-012 — Éligibilité d'âge par épreuve
-- Ajoute min_age/max_age sur game_competitions et game_competition_id sur selections.

ALTER TABLE public.game_competitions
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS max_age INTEGER;

ALTER TABLE public.selections
  ADD COLUMN IF NOT EXISTS game_competition_id UUID
    REFERENCES public.game_competitions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.athlete_kyc.age_eligibility_ok IS 'DEPRECATED — calculé par épreuve désormais';
COMMENT ON COLUMN public.athlete_kyc.min_age_ok IS 'DEPRECATED — calculé par épreuve désormais';
COMMENT ON COLUMN public.athlete_kyc.max_age_ok IS 'DEPRECATED — calculé par épreuve désormais';
