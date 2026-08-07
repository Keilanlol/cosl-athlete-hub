-- ============================================================================
-- 59 DOWN. Rollback de la migration 59
-- ============================================================================

DROP TABLE IF EXISTS public.accommodation_type_aliases;
DROP TABLE IF EXISTS public.transport_type_aliases;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0059';