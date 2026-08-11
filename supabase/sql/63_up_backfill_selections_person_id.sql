-- ============================================================================
-- 63 UP. Backfill de selections.person_id (via athlete_profiles puis athletes)
-- ============================================================================
-- À n'appliquer QUE si la requête de contrôle renvoie > 0 :
--   SELECT count(*) FROM selections
--   WHERE person_id IS NULL AND athlete_id IS NOT NULL;
--
-- Étapes :
--   1. Snapshot des selections avant modification
--   2. Backfill via athlete_profiles.legacy_athlete_id → person_id
--   3. Backfill fallback via athletes.id → athletes.person_id
--   4. Rapport des lignes non résolues (à exécuter par l'utilisateur après)
-- ============================================================================

BEGIN;

-- ── 1. Snapshot avant modification ─────────────────────────────────────────
DROP TABLE IF EXISTS migration_63_snapshot_selections;
CREATE TABLE migration_63_snapshot_selections AS
  SELECT * FROM public.selections;

-- ── 2. Backfill via athlete_profiles ───────────────────────────────────────
UPDATE public.selections s
SET person_id = ap.person_id
FROM public.athlete_profiles ap
WHERE s.athlete_id = ap.legacy_athlete_id
  AND s.person_id IS NULL
  AND ap.person_id IS NOT NULL;

-- ── 3. Fallback via athletes.person_id ─────────────────────────────────────
UPDATE public.selections s
SET person_id = ath.person_id
FROM public.athletes ath
WHERE s.athlete_id = ath.id
  AND s.person_id IS NULL
  AND ath.person_id IS NOT NULL;

-- ── 4. Enregistrer la migration ────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0063', 'backfill_selections_person_id')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ── 5. Requête de rapport (à exécuter par l'utilisateur après la migration) ─
-- Affiche les sélections qui n'ont pas pu être résolues (person_id reste NULL).
-- SELECT s.id, s.game_id, s.athlete_id, a.first_name, a.last_name
-- FROM public.selections s
-- LEFT JOIN public.athletes a ON a.id = s.athlete_id
-- WHERE s.person_id IS NULL AND s.athlete_id IS NOT NULL;