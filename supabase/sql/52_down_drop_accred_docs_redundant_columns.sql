-- ============================================================================
-- 52 DOWN. Rollback de la migration 52
-- ============================================================================

-- ── 1. Restaurer les colonnes file_name et file_url ─────────────────────────
ALTER TABLE public.accreditation_documents
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_url text;

-- ── 2. Restaurer les valeurs depuis le snapshot de la migration 51 ──────────
UPDATE public.accreditation_documents ad
SET
  file_name = snap.file_name,
  file_url = snap.file_url
FROM migration_51_snapshot_accreditation_documents snap
WHERE ad.id = snap.id;

-- ── 3. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0052';