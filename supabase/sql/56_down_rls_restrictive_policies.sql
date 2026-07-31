-- ============================================================================
-- 56 DOWN. Rollback de la migration 56
-- ============================================================================

-- ── Restaurer les policies permissives d'origine ────────────────────────────

-- person_documents
DROP POLICY IF EXISTS person_documents_select ON public.person_documents;
DROP POLICY IF EXISTS person_documents_write ON public.person_documents;
CREATE POLICY person_documents_all ON public.person_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- accreditation_requirements
DROP POLICY IF EXISTS accreditation_requirements_select ON public.accreditation_requirements;
DROP POLICY IF EXISTS accreditation_requirements_write ON public.accreditation_requirements;
CREATE POLICY accreditation_requirements_all ON public.accreditation_requirements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- app_type_items
DROP POLICY IF EXISTS app_type_items_select ON public.app_type_items;
DROP POLICY IF EXISTS app_type_items_write ON public.app_type_items;
CREATE POLICY app_type_items_all ON public.app_type_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- events
DROP POLICY IF EXISTS events_select ON public.events;
DROP POLICY IF EXISTS events_write ON public.events;
CREATE POLICY events_all ON public.events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- person_events
DROP POLICY IF EXISTS person_events_select ON public.person_events;
DROP POLICY IF EXISTS person_events_write ON public.person_events;
CREATE POLICY person_events_all ON public.person_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Supprimer la fonction helper ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- ── Retirer la migration du tracking ───────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0056';