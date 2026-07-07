-- ============================================================================
-- 38. Vue v_persons_in_games — liste les personnes associées à chaque Games
-- ============================================================================
-- Regroupe TOUTES les sources de liaison personne ↔ games :
--  1. Sélections (athlètes sélectionnés pour un games)
--  2. Membres de délégation (athlètes + encadrants)
--  3. Bénévoles (game_volunteers)
--  4. Chef de mission (delegations.chief_of_mission_id)
--  5. Accréditations (athlètes + encadrants)
-- 6. Passagers de vols (athlètes + encadrants)
--  7. Assignations d'hébergement (athlètes + encadrants)
--  8. Passagers de transport local (athlètes + encadrants)
--  9. Résultats d'athlètes (athlètes)
-- 10. Jeux de compétition (athlètes)
-- ============================================================================

DROP VIEW IF EXISTS public.v_persons_in_games;

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

  UNION

  -- 5a. Accréditations : athletes → persons
  SELECT a.person_id AS person_id, acc.game_id AS game_id
  FROM public.accreditations acc
  JOIN public.athletes a ON a.id = acc.athlete_id
  WHERE a.person_id IS NOT NULL

  UNION

  -- 5b. Accréditations : coaches → persons
  SELECT c.person_id AS person_id, acc.game_id AS game_id
  FROM public.accreditations acc
  JOIN public.coaches c ON c.id = acc.coach_id
  WHERE c.person_id IS NOT NULL

  UNION

  -- 6a. Passagers de vols : athletes → persons
  SELECT a.person_id AS person_id, tp.game_id AS game_id
  FROM public.flight_passengers fp
  JOIN public.flights f ON f.id = fp.flight_id
  JOIN public.travel_plans tp ON tp.id = f.travel_plan_id
  JOIN public.athletes a ON a.id = fp.athlete_id
  WHERE a.person_id IS NOT NULL

  UNION

  -- 6b. Passagers de vols : coaches → persons
  SELECT c.person_id AS person_id, tp.game_id AS game_id
  FROM public.flight_passengers fp
  JOIN public.flights f ON f.id = fp.flight_id
  JOIN public.travel_plans tp ON tp.id = f.travel_plan_id
  JOIN public.coaches c ON c.id = fp.coach_id
  WHERE c.person_id IS NOT NULL

  UNION

  -- 7a. Assignations d'hébergement : athletes → persons
  SELECT a.person_id AS person_id, acc.game_id AS game_id
  FROM public.rooming_assignments ra
  JOIN public.accommodations acc ON acc.id = ra.accommodation_id
  JOIN public.athletes a ON a.id = ra.athlete_id
  WHERE a.person_id IS NOT NULL

  UNION

  -- 7b. Assignations d'hébergement : coaches → persons
  SELECT c.person_id AS person_id, acc.game_id AS game_id
  FROM public.rooming_assignments ra
  JOIN public.accommodations acc ON acc.id = ra.accommodation_id
  JOIN public.coaches c ON c.id = ra.coach_id
  WHERE c.person_id IS NOT NULL

  UNION

  -- 8a. Passagers de transport local : athletes → persons
  SELECT a.person_id AS person_id, lt.game_id AS game_id
  FROM public.local_transport_passengers ltp
  JOIN public.local_transports lt ON lt.id = ltp.local_transport_id
  JOIN public.athletes a ON a.id = ltp.athlete_id
  WHERE a.person_id IS NOT NULL

  UNION

  -- 8b. Passagers de transport local : coaches → persons
  SELECT c.person_id AS person_id, lt.game_id AS game_id
  FROM public.local_transport_passengers ltp
  JOIN public.local_transports lt ON lt.id = ltp.local_transport_id
  JOIN public.coaches c ON c.id = ltp.coach_id
  WHERE c.person_id IS NOT NULL

  UNION

  -- 9. Résultats d'athlètes
  SELECT a.person_id AS person_id, ar.game_id AS game_id
  FROM public.athlete_results ar
  JOIN public.athletes a ON a.id = ar.athlete_id
  WHERE a.person_id IS NOT NULL AND ar.game_id IS NOT NULL

) AS combined
WHERE person_id IS NOT NULL AND game_id IS NOT NULL;

GRANT SELECT ON public.v_persons_in_games TO authenticated;