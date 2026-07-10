-- ============================================================================
-- 41 DOWN. Rollback de la migration 41
-- ============================================================================

ALTER TABLE public.athletes DROP COLUMN IF EXISTS last_medical_check;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0041';