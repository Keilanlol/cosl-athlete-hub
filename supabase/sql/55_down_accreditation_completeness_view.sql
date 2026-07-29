-- ============================================================================
-- 55 DOWN. Rollback de la migration 55
-- ============================================================================

DROP VIEW IF EXISTS public.v_accreditation_completeness;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0055';