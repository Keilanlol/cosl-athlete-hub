-- ============================================================================
-- 56 UP. RLS — policies restrictives pour les tables sensibles
-- ============================================================================
-- Réécrit les policies des 5 tables prioritaires identifiées dans l'audit :
--   person_documents, accreditation_requirements, app_type_items,
--   events, person_events
--
-- Rôles :
--   reader        : lecture seule, pas d'accès aux documents d'identité/médicaux
--   fed_manager   : lecture (filtrage par fédération non implémenté — voir note)
--   games_manager : accès complet
--   admin         : accès complet
--   autres        : lecture sur données non sensibles, pas d'écriture
--
-- ⚠️ Note : fed_manager ne peut pas être limité à sa fédération car
--    user_profiles n'a pas de colonne federation_id. À corriger dans une
--    migration future en ajoutant federation_id à user_profiles.
-- ============================================================================

-- ── 1. Fonction helper : récupérer le rôle de l'utilisateur courant ─────────
-- SECURITY DEFINER pour bypasser RLS sur user_profiles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text FROM public.user_profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- ── 2. person_documents ─────────────────────────────────────────────────────
-- Drop ancienne policy permissive
DROP POLICY IF EXISTS person_documents_all ON public.person_documents;

-- SELECT : tout le monde peut lire, sauf reader sur docs sensibles
CREATE POLICY person_documents_select ON public.person_documents
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'games_manager', 'fed_manager', 'logistics', 'communication')
    OR (
      public.get_current_user_role() = 'reader'
      AND NOT (
        category = 'medical'
        OR doc_type IN ('passport', 'id_card', 'cns_card', 'medical_form', 'medical_cert', 'medical_license')
      )
    )
  );

-- INSERT/UPDATE/DELETE : admin et games_manager uniquement
CREATE POLICY person_documents_write ON public.person_documents
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'games_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'games_manager'));

-- ── 3. accreditation_requirements ───────────────────────────────────────────
DROP POLICY IF EXISTS accreditation_requirements_all ON public.accreditation_requirements;

-- SELECT : tout le monde peut lire
CREATE POLICY accreditation_requirements_select ON public.accreditation_requirements
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE : admin et games_manager uniquement
CREATE POLICY accreditation_requirements_write ON public.accreditation_requirements
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'games_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'games_manager'));

-- ── 4. app_type_items ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS app_type_items_all ON public.app_type_items;

-- SELECT : tout le monde peut lire
CREATE POLICY app_type_items_select ON public.app_type_items
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE : admin uniquement
CREATE POLICY app_type_items_write ON public.app_type_items
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- ── 5. events ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS events_all ON public.events;

-- SELECT : tout le monde peut lire
CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE : admin et games_manager
CREATE POLICY events_write ON public.events
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'games_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'games_manager'));

-- ── 6. person_events ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS person_events_all ON public.person_events;

-- SELECT : tout le monde peut lire
CREATE POLICY person_events_select ON public.person_events
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE : admin et games_manager
CREATE POLICY person_events_write ON public.person_events
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'games_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'games_manager'));

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0056', 'rls_restrictive_policies')
ON CONFLICT (version) DO NOTHING;