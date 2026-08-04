-- ============================================================================
-- 57 DOWN. Rollback de la migration 57
-- ============================================================================

-- ── 1. Supprimer les policies dynamiques ────────────────────────────────────
-- Restaurer les policies permissives sur les 5 tables
DROP POLICY IF EXISTS person_documents_select ON public.person_documents;
DROP POLICY IF EXISTS person_documents_write ON public.person_documents;
CREATE POLICY person_documents_all ON public.person_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS accreditation_requirements_select ON public.accreditation_requirements;
DROP POLICY IF EXISTS accreditation_requirements_write ON public.accreditation_requirements;
CREATE POLICY accreditation_requirements_all ON public.accreditation_requirements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_type_items_select ON public.app_type_items;
DROP POLICY IF EXISTS app_type_items_write ON public.app_type_items;
CREATE POLICY app_type_items_all ON public.app_type_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS events_select ON public.events;
DROP POLICY IF EXISTS events_write ON public.events;
CREATE POLICY events_all ON public.events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS person_events_select ON public.person_events;
DROP POLICY IF EXISTS person_events_write ON public.person_events;
CREATE POLICY person_events_all ON public.person_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Supprimer les fonctions ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.can_access(text, text);
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);

-- ── 3. Supprimer les tables ────────────────────────────────────────────────
DROP TABLE IF EXISTS public.role_document_access;
DROP TABLE IF EXISTS public.role_permissions;

-- ── 4. Restaurer user_profiles.role en enum ─────────────────────────────────
ALTER TABLE public.user_profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_profiles ALTER COLUMN role TYPE public.user_role USING role::public.user_role;
ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'reader'::public.user_role;

-- ── 5. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0057';