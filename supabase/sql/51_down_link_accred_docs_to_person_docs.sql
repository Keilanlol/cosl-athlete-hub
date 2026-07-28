-- ============================================================================
-- 51 DOWN. Rollback de la migration 51
-- ============================================================================

-- ── 1. Supprimer la colonne person_document_id ──────────────────────────────
ALTER TABLE public.accreditation_documents DROP COLUMN IF EXISTS person_document_id;

-- ── 2. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0051';

-- Note : le snapshot est conservé (par sécurité).