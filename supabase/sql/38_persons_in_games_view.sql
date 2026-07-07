-- ============================================================================
-- 38. Vue v_persons_in_games — liste les personnes associées à chaque Games
-- ============================================================================
-- Regroupe toutes les sources de liaison personne ↔ games :
-- 1. Sélections (athlètes sélectionnés pour un games)
-- 2. Membres de délégation (athlètes + encadrants)
-- 3. Bénévoles (game_volunteers)
-- 4. Chef de mission (delegations.chief_of_mission_id)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_persons_in_games AS
SELECT DISTINCT person_id, game_id FROM (
  -- 1. Sélections : athletes → persons
  SELECT a.person_id AS person_id, s.game_id AS game_id
  FROM public.selections s
  JOIN public.athletes a ON a.id = s.athlete_id
  WHERE a.person_id IS NOT NULL

  UNION

  -- 2a. Délégation membres : athletes → persons
  SELECT a.person_id AS person_id, d.game_id AS game_id
  FROM public.delegation_members dm
  JOIN public.delegations d ON d.id = dm.delegation_id
  JOIN public.athletes a ON a.id = dm.athlete_id
  WHERE a.person_id IS NOT NULL

  UNION

  -- 2b. Délégation membres : coaches → persons
  SELECT c.person_id AS person_id, d.game_id AS game_id
  FROM public.delegation_members dm
  JOIN public.delegations d ON d.id = dm.delegation_id
  JOIN public.coaches c ON c.id = dm.coach_id
  WHERE c.person_id IS NOT NULL

  UNION

  -- 3. Bénévoles
  SELECT gv.person_id AS person_id, gv.game_id AS game_id
  FROM public.game_volunteers gv

  UNION

  -- 4. Chef de mission
  SELECT d.chief_of_mission_id AS person_id, d.game_id AS game_id
  FROM public.delegations d
  WHERE d.chief_of_mission_id IS NOT NULL
) AS combined
WHERE person_id IS NOT NULL AND game_id IS NOT NULL;

GRANT SELECT ON public.v_persons_in_games TO authenticated;