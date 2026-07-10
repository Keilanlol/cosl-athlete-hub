-- ============================================================================
-- 40 DOWN. Rollback de la migration 40
-- ============================================================================
-- Supprime les tables events et person_events.
-- ============================================================================

DROP TABLE IF EXISTS public.person_events;
DROP TABLE IF EXISTS public.events;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0040';