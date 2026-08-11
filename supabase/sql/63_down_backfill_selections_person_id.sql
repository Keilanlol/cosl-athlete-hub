-- ============================================================================
-- 63 DOWN. Rollback de la migration 63
-- ============================================================================
-- Restaure les person_id NULL depuis le snapshot.
-- ============================================================================

BEGIN;

-- ── Restaurer les person_id depuis le snapshot ──────────────────────────────
-- On ne restaure que les lignes où person_id était NULL dans le snapshot.
UPDATE public.selections s
SET person_id = snap.person_id
FROM migration_63_snapshot_selections snap
WHERE s.id = snap.id
  AND snap.person_id IS NULL
  AND s.person_id IS NOT NULL;

-- ── Supprimer le snapshot ───────────────────────────────────────────────────
-- Le snapshot est conservé par sécurité. Suppression manuelle optionnelle.
-- DROP TABLE IF EXISTS migration_63_snapshot_selections;

-- ── Retirer la migration du tracking ────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0063';

COMMIT;