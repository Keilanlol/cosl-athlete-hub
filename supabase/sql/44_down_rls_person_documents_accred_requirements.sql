-- ============================================================================
-- 44 DOWN. Rollback de la migration 44
-- ============================================================================

DROP POLICY IF EXISTS accreditation_requirements_all ON public.accreditation_requirements;
DROP POLICY IF EXISTS person_documents_all ON public.person_documents;

-- On laisse RLS activé (plus sûr) mais sans policy = tout est bloqué
-- ce qui correspond à l'état avant la migration 44.

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0044';