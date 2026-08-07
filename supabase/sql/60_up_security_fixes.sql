-- ============================================================================
-- 60 UP. Correctifs de sécurité isolés
-- ============================================================================
-- 1. Déplacer les snapshots de migration vers un schéma non exposé
-- 2. RLS sur tables techniques
-- 3. security_invoker sur v_accreditation_completeness
-- 4. Garde de rôle dans sync_accreditations_for_game
-- 5. RPC admin_update_user_role (remplace UPDATE client direct)
-- 6. Correction de can_access() (can_delete n'impliquait pas can_write)
-- 7. Rétablir le filtre par doc_type pour reader sur person_documents
-- ============================================================================

-- ── 1. Déplacer les snapshots vers un schéma non exposé ─────────────────────
CREATE SCHEMA IF NOT EXISTS migration_backups;

-- Révoquer tous les droits du schéma public sur ces tables
REVOKE ALL ON public.migration_47_snapshot_fk_constraints FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_51_snapshot_accreditation_documents FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_54_snapshot_accreditations FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_48_snapshot_app_type_items FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_48_snapshot_person_documents FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_48_snapshot_accreditation_documents FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_48_snapshot_accreditation_requirements FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_48_snapshot_document_types FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_49_snapshot_app_type_items_coach_roles FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_49_snapshot_accreditations FROM PUBLIC, authenticated;
REVOKE ALL ON public.migration_49_snapshot_coach_profiles FROM PUBLIC, authenticated;

-- Déplacer les tables vers migration_backups
ALTER TABLE IF EXISTS public.migration_47_snapshot_fk_constraints SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_51_snapshot_accreditation_documents SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_54_snapshot_accreditations SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_48_snapshot_app_type_items SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_48_snapshot_person_documents SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_48_snapshot_accreditation_documents SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_48_snapshot_accreditation_requirements SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_48_snapshot_document_types SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_49_snapshot_app_type_items_coach_roles SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_49_snapshot_accreditations SET SCHEMA migration_backups;
ALTER TABLE IF EXISTS public.migration_49_snapshot_coach_profiles SET SCHEMA migration_backups;

-- Révoquer tous les droits sur le schéma migration_backups
REVOKE ALL ON SCHEMA migration_backups FROM PUBLIC, anon, authenticated;

-- ── 2. RLS sur tables techniques ─────────────────────────────────────────────
-- doc_type_aliases : table technique, aucun accès
ALTER TABLE public.doc_type_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doc_type_aliases_all ON public.doc_type_aliases;
-- Aucune policy = aucun accès via PostgREST

-- document_type_codes : lecture pour authenticated, écriture admin
ALTER TABLE public.document_type_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_type_codes_all ON public.document_type_codes;
CREATE POLICY document_type_codes_select ON public.document_type_codes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY document_type_codes_write ON public.document_type_codes
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- accreditation_category_codes : lecture pour authenticated, écriture admin
ALTER TABLE public.accreditation_category_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accreditation_category_codes_all ON public.accreditation_category_codes;
CREATE POLICY accreditation_category_codes_select ON public.accreditation_category_codes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY accreditation_category_codes_write ON public.accreditation_category_codes
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- role_accreditation_mapping : lecture pour authenticated, écriture admin
ALTER TABLE public.role_accreditation_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_accreditation_mapping_all ON public.role_accreditation_mapping;
CREATE POLICY role_accreditation_mapping_select ON public.role_accreditation_mapping
  FOR SELECT TO authenticated USING (true);
CREATE POLICY role_accreditation_mapping_write ON public.role_accreditation_mapping
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- ── 3. security_invoker sur v_accreditation_completeness ────────────────────
-- La vue s'exécute avec les droits de son propriétaire et contourne les
-- policies de person_documents. On la recrée avec security_invoker.
DROP VIEW IF EXISTS public.v_accreditation_completeness;
CREATE VIEW public.v_accreditation_completeness
WITH (security_invoker = true) AS
SELECT
  a.id AS accreditation_id,
  a.game_id,
  a.person_id,
  a.role_code,
  (
    SELECT count(DISTINCT ar.doc_type_code)
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = a.game_id
      AND ar.role_code = a.role_code
      AND ar.required = true
      AND (
        ar.selection_stage IS NULL
        OR ar.selection_stage = (
          SELECT s.status::text FROM public.selections s
          WHERE s.game_id = a.game_id
            AND (s.person_id = a.person_id OR s.athlete_id = a.athlete_id)
            AND s.status IN ('pre_selected', 'selected', 'reserve')
          ORDER BY s.status DESC
          LIMIT 1
        )
      )
  ) AS required_count,
  (
    SELECT count(DISTINCT ad.person_document_id)
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = a.id
      AND ad.status = 'valid'
      AND pd.status = 'valid'
      AND (pd.expiry_date IS NULL OR pd.expiry_date >= COALESCE(
        (SELECT g.competition_start FROM public.games g WHERE g.id = a.game_id),
        CURRENT_DATE
      ))
  ) AS provided_count
FROM public.accreditations a;

GRANT SELECT ON public.v_accreditation_completeness TO authenticated;

-- ── 4. Garde de rôle dans sync_accreditations_for_game ──────────────────────
-- Ajouter un contrôle en tête de fonction : admin ou games_manager uniquement
CREATE OR REPLACE FUNCTION public.sync_accreditations_for_game(p_game_id uuid)
RETURNS TABLE(
  selection_id uuid,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role text;
  sel RECORD;
  v_person_id uuid;
  v_full_name text;
  v_role_code text;
  v_coach_role text;
  v_fed_role text;
  v_mapped_cat text;
BEGIN
  -- Garde : seul admin ou games_manager peut synchroniser
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'games_manager') THEN
    RAISE EXCEPTION 'Accès refusé : rôle % non autorisé à synchroniser les accréditations', v_caller_role;
  END IF;

  FOR sel IN
    SELECT s.id, s.athlete_id, s.person_id, s.status
    FROM public.selections s
    WHERE s.game_id = p_game_id
      AND s.status IN ('pre_selected', 'selected', 'reserve')
  LOOP
    v_person_id := sel.person_id;
    v_full_name := '';
    v_role_code := 'athlete';

    IF sel.athlete_id IS NOT NULL AND v_person_id IS NULL THEN
      SELECT ap.person_id INTO v_person_id
      FROM public.athlete_profiles ap
      WHERE ap.legacy_athlete_id = sel.athlete_id
      LIMIT 1;

      IF v_person_id IS NULL THEN
        SELECT ath.person_id INTO v_person_id
        FROM public.athletes ath
        WHERE ath.id = sel.athlete_id
        LIMIT 1;
      END IF;
    END IF;

    IF v_person_id IS NULL THEN
      v_person_id := NULL;
      v_full_name := '';
      v_role_code := 'athlete';
      v_coach_role := NULL;
      v_fed_role := NULL;
      v_mapped_cat := NULL;
      CONTINUE;
    END IF;

    SELECT (p.first_name || ' ' || p.last_name) INTO v_full_name
    FROM public.persons p
    WHERE p.id = v_person_id;

    IF sel.athlete_id IS NULL AND v_person_id IS NOT NULL THEN
      SELECT cp.role INTO v_coach_role
      FROM public.coach_profiles cp
      WHERE cp.person_id = v_person_id AND cp.is_active = true
      LIMIT 1;

      IF v_coach_role IS NOT NULL THEN
        SELECT ram.accreditation_category INTO v_mapped_cat
        FROM public.role_accreditation_mapping ram
        WHERE ram.source_group = 'coach_roles' AND ram.source_code = v_coach_role;
        v_role_code := COALESCE(v_mapped_cat, 'coach');
      ELSE
        SELECT fmp.role INTO v_fed_role
        FROM public.federation_member_profiles fmp
        WHERE fmp.person_id = v_person_id AND fmp.is_active = true
        LIMIT 1;

        IF v_fed_role IS NOT NULL THEN
          SELECT ram.accreditation_category INTO v_mapped_cat
          FROM public.role_accreditation_mapping ram
          WHERE ram.source_group = 'federation_member_roles' AND ram.source_code = v_fed_role;
          v_role_code := COALESCE(v_mapped_cat, 'official');
        END IF;
      END IF;
    END IF;

    INSERT INTO public.accreditations (game_id, person_id, full_name, status, role_code)
    VALUES (p_game_id, v_person_id, v_full_name, 'draft', v_role_code)
    ON CONFLICT DO NOTHING;

    v_person_id := NULL;
    v_full_name := '';
    v_role_code := 'athlete';
    v_coach_role := NULL;
    v_fed_role := NULL;
    v_mapped_cat := NULL;
  END LOOP;

  RETURN QUERY
  SELECT s.id, 'Pas de person_id résolu'::text
  FROM public.selections s
  WHERE s.game_id = p_game_id
    AND s.status IN ('pre_selected', 'selected', 'reserve')
    AND s.person_id IS NULL
    AND s.athlete_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.athlete_profiles ap
      WHERE ap.legacy_athlete_id = s.athlete_id AND ap.person_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.athletes ath
      WHERE ath.id = s.athlete_id AND ath.person_id IS NOT NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_accreditations_for_game(uuid) TO authenticated;

-- ── 5. RPC admin_update_user_role ────────────────────────────────────────────
-- Remplace l'UPDATE client direct sur user_profiles.role
CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role text;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé : seul un administrateur peut modifier le rôle d''un utilisateur';
  END IF;

  UPDATE public.user_profiles
  SET role = p_role
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;

-- ── 6. Correction de can_access() ───────────────────────────────────────────
-- Bug : can_delete=true et can_write=false n'obtenait pas 'write'.
-- Correction : can_write inclut implicitement read, can_delete inclut
-- implicitement write et read.
CREATE OR REPLACE FUNCTION public.can_access(p_module text, p_action text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT
      CASE p_action
        WHEN 'read'   THEN rp.can_read OR rp.can_write OR rp.can_delete
        WHEN 'write'  THEN rp.can_write OR rp.can_delete
        WHEN 'delete' THEN rp.can_delete
        ELSE false
      END
     FROM public.role_permissions rp
     JOIN public.user_profiles up ON up.id = auth.uid()
     WHERE rp.role_code = up.role AND rp.module = p_module),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access(text, text) TO authenticated;

-- ── 7. Rétablir le filtre par doc_type pour reader sur person_documents ──────
-- La migration 57 filtrait uniquement sur category (texte libre = 'admin').
-- On rétablit le filtre par doc_type en plus du filtre par category.
DROP POLICY IF EXISTS person_documents_select ON public.person_documents;

CREATE POLICY person_documents_select ON public.person_documents
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.role_document_access rda
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE rda.role_code = up.role
        AND rda.can_read = true
        AND rda.doc_category = COALESCE(person_documents.category, 'admin')
    )
    -- Filtre supplémentaire : reader ne voit pas les documents d'identité
    -- même si la category est mal renseignée
    AND NOT (
      public.get_current_user_role() = 'reader'
      AND person_documents.doc_type IN (
        'passport', 'id_card', 'cns_card',
        'medical_form', 'medical_cert', 'medical_license',
        'visa', 'photo_identite'
      )
    )
  );

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0060', 'security_fixes')
ON CONFLICT (version) DO NOTHING;