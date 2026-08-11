-- ============================================================================
-- 65 UP. Fonction SQL unique + liaison automatique + backfill role_code
-- ============================================================================
-- 1. get_required_doc_types(p_person_id, p_game_id) : SOURCE UNIQUE
-- 2. Colonne unlinked_at sur accreditation_documents
-- 3. Index (accreditation_id, person_document_id)
-- 3bis. Réécriture de v_accreditation_completeness
-- 4. Trigger auto_link_person_docs()
-- 5. RPC link_available_docs(p_accreditation_id)
-- 6. RPC link_all_existing_docs(p_dry_run)
-- 7. Backfill accreditations.role_code
-- 8. sync_accreditations_for_game : ON CONFLICT DO UPDATE
-- ============================================================================
-- RÈGLES :
--   - Le trigger ne se déclenche QUE pour NEW.status = 'valid'.
--   - Le trigger crée TOUJOURS status = 'pending' (validation humaine).
--   - Le trigger n'écrase jamais un document déjà lié et non délié.
--   - Le trigger respecte unlinked_at.
--   - role_code = champ d'AFFICHAGE uniquement, jamais utilisé pour le calcul.
--
-- NOTE TYPES : person_roles.role_type est un ENUM (person_role_type).
--   Toute comparaison avec role_accreditation_mapping.source_code (text)
--   exige ::text, sinon : operator does not exist: text = person_role_type
--
-- RÉCURSION : ce trigger écrit dans accreditation_documents. Aucun trigger
--   n'existe sur cette table. Ne jamais en ajouter un qui écrirait dans
--   person_documents : boucle infinie.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS migration_backups;
REVOKE ALL ON SCHEMA migration_backups FROM anon, authenticated, PUBLIC;

DROP TABLE IF EXISTS migration_backups.migration_65_snapshot_accreditation_documents;
CREATE TABLE migration_backups.migration_65_snapshot_accreditation_documents AS
  SELECT * FROM public.accreditation_documents;

DROP TABLE IF EXISTS migration_backups.migration_65_snapshot_accreditations;
CREATE TABLE migration_backups.migration_65_snapshot_accreditations AS
  SELECT id, role_code FROM public.accreditations;

DROP TABLE IF EXISTS migration_backups.migration_65_snapshot_view_def;
CREATE TABLE migration_backups.migration_65_snapshot_view_def AS
  SELECT pg_get_viewdef('public.v_accreditation_completeness'::regclass, true) AS definition;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. get_required_doc_types — SOURCE UNIQUE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_required_doc_types(
  p_person_id uuid,
  p_game_id   uuid
)
RETURNS TABLE(
  doc_type_code   text,
  role_label      text,
  discipline_name text,
  stage_label     text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_type  text;
  v_coach_role text;
  v_fed_role   text;
  v_category   text;
  v_cat_label  text;
BEGIN
  IF p_person_id IS NULL OR p_game_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_role_type IN
    SELECT pr.role_type::text
    FROM public.person_roles pr
    WHERE pr.person_id = p_person_id
      AND pr.is_active = true
    ORDER BY
      CASE pr.role_type::text
        WHEN 'athlete'           THEN 1
        WHEN 'coach'             THEN 2
        WHEN 'federation_member' THEN 3
        WHEN 'official'          THEN 4
        WHEN 'volunteer'         THEN 5
        WHEN 'staff'             THEN 6
        ELSE 99
      END
  LOOP
    v_category   := NULL;
    v_coach_role := NULL;
    v_fed_role   := NULL;

    IF v_role_type = 'athlete' THEN
      v_category := 'athlete';

    ELSIF v_role_type = 'coach' THEN
      SELECT cp.role INTO v_coach_role
      FROM public.coach_profiles cp
      WHERE cp.person_id = p_person_id AND cp.is_active = true
      LIMIT 1;

      IF v_coach_role IS NOT NULL THEN
        SELECT ram.accreditation_category INTO v_category
        FROM public.role_accreditation_mapping ram
        WHERE ram.source_group = 'coach_roles'
          AND ram.source_code  = v_coach_role;
      END IF;
      v_category := COALESCE(v_category, 'coach');

    ELSIF v_role_type = 'federation_member' THEN
      SELECT fmp.role INTO v_fed_role
      FROM public.federation_member_profiles fmp
      WHERE fmp.person_id = p_person_id AND fmp.is_active = true
      LIMIT 1;

      IF v_fed_role IS NOT NULL THEN
        SELECT ram.accreditation_category INTO v_category
        FROM public.role_accreditation_mapping ram
        WHERE ram.source_group = 'federation_member_roles'
          AND ram.source_code  = v_fed_role;
      END IF;
      v_category := COALESCE(v_category, 'official');

    ELSE
      SELECT ram.accreditation_category INTO v_category
      FROM public.role_accreditation_mapping ram
      WHERE ram.source_group = 'person_role_types'
        AND ram.source_code  = v_role_type;   -- v_role_type est déjà text
      v_category := COALESCE(v_category, 'official');
    END IF;

    SELECT ati.label INTO v_cat_label
    FROM public.app_type_items ati
    WHERE ati.group_key = 'accreditation_categories'
      AND ati.code      = v_category;
    v_cat_label := COALESCE(v_cat_label, v_category);

    -- Requirements sans étape : toujours exigés
    RETURN QUERY
    SELECT ar.doc_type_code, v_cat_label, NULL::text, 'Toutes étapes'::text
    FROM public.accreditation_requirements ar
    WHERE ar.game_id         = p_game_id
      AND ar.role_code       = v_category
      AND ar.required        = true
      AND ar.selection_stage IS NULL;

    -- Requirements par étape : union de toutes les sélections actives
    RETURN QUERY
    SELECT
      ar.doc_type_code,
      v_cat_label,
      COALESCE(d.name, sp.name),
      ar.selection_stage
    FROM public.accreditation_requirements ar
    JOIN public.selections sel
      ON  sel.game_id     = p_game_id
      AND sel.person_id   = p_person_id
      AND sel.status::text = ar.selection_stage
      AND sel.status::text IN ('pre_selected', 'selected', 'reserve')
    LEFT JOIN public.sports      sp ON sp.id = sel.sport_id
    LEFT JOIN public.disciplines d  ON d.id  = sel.discipline_id
    WHERE ar.game_id         = p_game_id
      AND ar.role_code       = v_category
      AND ar.required        = true
      AND ar.selection_stage IS NOT NULL;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_required_doc_types(uuid, uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2 & 3. unlinked_at + index
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.accreditation_documents
  ADD COLUMN IF NOT EXISTS unlinked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_accred_docs_accred_person_doc
  ON public.accreditation_documents (accreditation_id, person_document_id)
  WHERE person_document_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3bis. v_accreditation_completeness
-- ════════════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.v_accreditation_completeness;
CREATE VIEW public.v_accreditation_completeness
WITH (security_invoker = true) AS
SELECT
  a.id       AS accreditation_id,
  a.game_id,
  a.person_id,
  a.role_code,
  (
    SELECT count(DISTINCT rdt.doc_type_code)
    FROM public.get_required_doc_types(a.person_id, a.game_id) rdt
  ) AS required_count,
  (
    SELECT count(DISTINCT ad.person_document_id)
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = a.id
      AND ad.status      = 'valid'
      AND ad.unlinked_at IS NULL
      AND pd.status      = 'valid'
      AND (pd.expiry_date IS NULL OR pd.expiry_date >= COALESCE(
            (SELECT g.competition_start FROM public.games g WHERE g.id = a.game_id),
            CURRENT_DATE))
  ) AS provided_count
FROM public.accreditations a
WHERE a.person_id IS NOT NULL;

GRANT SELECT ON public.v_accreditation_completeness TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Trigger auto_link_person_docs
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_link_person_docs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_accred          RECORD;
  v_is_required     boolean;
  v_existing_id     uuid;
  v_existing_pd_id  uuid;
  v_existing_created timestamptz;
  v_unlinked_found  boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'valid' OR NEW.person_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_accred IN
    SELECT a.id, a.game_id
    FROM public.accreditations a
    WHERE a.person_id = NEW.person_id
  LOOP
    SELECT EXISTS(
      SELECT 1
      FROM public.get_required_doc_types(NEW.person_id, v_accred.game_id) r
      WHERE r.doc_type_code = NEW.doc_type
    ) INTO v_is_required;

    IF NOT v_is_required THEN
      CONTINUE;
    END IF;

    -- Liaison active existante ?
    v_existing_id := NULL;
    SELECT ad.id, ad.person_document_id, pd.created_at
      INTO v_existing_id, v_existing_pd_id, v_existing_created
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = v_accred.id
      AND pd.doc_type         = NEW.doc_type
      AND ad.unlinked_at      IS NULL
    ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
    LIMIT 1;

    IF FOUND AND v_existing_id IS NOT NULL THEN
      -- Ne pas écraser. Signaler si le nouveau document est plus récent.
      IF v_existing_pd_id IS DISTINCT FROM NEW.id
         AND NEW.created_at > v_existing_created THEN
        BEGIN
          INSERT INTO public.notifications (
            notification_type, message,
            related_game_id, related_person_id, related_doc_type, is_read
          ) VALUES (
            'document_action_required',
            'Document plus récent disponible pour le type ' || NEW.doc_type
              || ' — à examiner depuis l''onglet Accréditations',
            v_accred.game_id, NEW.person_id, NEW.doc_type, false
          );
        EXCEPTION WHEN OTHERS THEN
          -- Une notification en échec ne doit JAMAIS bloquer l'upload
          RAISE WARNING 'Notification non créée : %', SQLERRM;
        END;
      END IF;
      CONTINUE;
    END IF;

    -- Liaison déliée : respecter l'intention de l'utilisateur
    SELECT EXISTS(
      SELECT 1
      FROM public.accreditation_documents ad
      JOIN public.person_documents pd ON pd.id = ad.person_document_id
      WHERE ad.accreditation_id = v_accred.id
        AND pd.doc_type         = NEW.doc_type
        AND ad.unlinked_at      IS NOT NULL
    ) INTO v_unlinked_found;

    IF v_unlinked_found THEN
      CONTINUE;
    END IF;

    INSERT INTO public.accreditation_documents (
      accreditation_id, person_document_id, status, uploaded_at
    ) VALUES (v_accred.id, NEW.id, 'pending', now());
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_person_docs_insert ON public.person_documents;
CREATE TRIGGER trg_auto_link_person_docs_insert
  AFTER INSERT ON public.person_documents
  FOR EACH ROW
  WHEN (NEW.status = 'valid')
  EXECUTE FUNCTION public.auto_link_person_docs();

DROP TRIGGER IF EXISTS trg_auto_link_person_docs_update ON public.person_documents;
CREATE TRIGGER trg_auto_link_person_docs_update
  AFTER UPDATE ON public.person_documents
  FOR EACH ROW
  WHEN (NEW.status = 'valid' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.auto_link_person_docs();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. RPC link_available_docs — bouton du drawer
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.link_available_docs(p_accreditation_id uuid)
RETURNS TABLE(doc_type_code text, linked boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_game_id   uuid;
  v_person_id uuid;
  v_doc_type  text;
  v_best_id   uuid;
  v_has_link  boolean;
  v_unlinked  boolean;
BEGIN
  SELECT a.game_id, a.person_id INTO v_game_id, v_person_id
  FROM public.accreditations a
  WHERE a.id = p_accreditation_id;

  IF NOT FOUND OR v_person_id IS NULL THEN
    RETURN QUERY SELECT NULL::text, false, 'Accréditation introuvable ou sans personne'::text;
    RETURN;
  END IF;

  FOR v_doc_type IN
    SELECT DISTINCT r.doc_type_code
    FROM public.get_required_doc_types(v_person_id, v_game_id) r
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.accreditation_documents ad
      JOIN public.person_documents pd ON pd.id = ad.person_document_id
      WHERE ad.accreditation_id = p_accreditation_id
        AND pd.doc_type = v_doc_type AND ad.unlinked_at IS NULL
    ) INTO v_has_link;

    IF v_has_link THEN
      RETURN QUERY SELECT v_doc_type, false, 'Déjà lié'::text;
      CONTINUE;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.accreditation_documents ad
      JOIN public.person_documents pd ON pd.id = ad.person_document_id
      WHERE ad.accreditation_id = p_accreditation_id
        AND pd.doc_type = v_doc_type AND ad.unlinked_at IS NOT NULL
    ) INTO v_unlinked;

    IF v_unlinked THEN
      RETURN QUERY SELECT v_doc_type, false, 'Délié par l''utilisateur'::text;
      CONTINUE;
    END IF;

    v_best_id := NULL;
    SELECT pd.id INTO v_best_id
    FROM public.person_documents pd
    WHERE pd.person_id = v_person_id
      AND pd.doc_type  = v_doc_type
      AND pd.status    = 'valid'
    ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
    LIMIT 1;

    IF v_best_id IS NULL THEN
      RETURN QUERY SELECT v_doc_type, false, 'Aucun document valide disponible'::text;
    ELSE
      INSERT INTO public.accreditation_documents (
        accreditation_id, person_document_id, status, uploaded_at
      ) VALUES (p_accreditation_id, v_best_id, 'pending', now());
      RETURN QUERY SELECT v_doc_type, true, 'Liaison créée (pending)'::text;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_available_docs(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RPC link_all_existing_docs — rattrapage (dry run par défaut)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.link_all_existing_docs(p_dry_run boolean DEFAULT true)
RETURNS TABLE(
  accreditation_id uuid,
  full_name        text,
  game_short_name  text,
  doc_type_code    text,
  would_link       boolean,
  reason           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role      text;
  v_accred    RECORD;
  v_doc_type  text;
  v_best_id   uuid;
  v_game_name text;
  v_has_link  boolean;
  v_unlinked  boolean;
  n_link      int := 0;
  n_already   int := 0;
  n_unlinked  int := 0;
  n_nodoc     int := 0;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'games_manager') THEN
    RAISE EXCEPTION 'Accès refusé : rôle % non autorisé', COALESCE(v_role, 'inconnu');
  END IF;

  FOR v_accred IN
    SELECT a.id, a.game_id, a.person_id, a.full_name
    FROM public.accreditations a
    WHERE a.person_id IS NOT NULL
    ORDER BY a.full_name
  LOOP
    SELECT g.short_name INTO v_game_name FROM public.games g WHERE g.id = v_accred.game_id;
    v_game_name := COALESCE(v_game_name, v_accred.game_id::text);

    FOR v_doc_type IN
      SELECT DISTINCT r.doc_type_code
      FROM public.get_required_doc_types(v_accred.person_id, v_accred.game_id) r
    LOOP
      SELECT EXISTS(
        SELECT 1 FROM public.accreditation_documents ad
        JOIN public.person_documents pd ON pd.id = ad.person_document_id
        WHERE ad.accreditation_id = v_accred.id
          AND pd.doc_type = v_doc_type AND ad.unlinked_at IS NULL
      ) INTO v_has_link;

      IF v_has_link THEN
        n_already := n_already + 1;
        RETURN QUERY SELECT v_accred.id, v_accred.full_name, v_game_name, v_doc_type, false, 'Déjà lié'::text;
        CONTINUE;
      END IF;

      SELECT EXISTS(
        SELECT 1 FROM public.accreditation_documents ad
        JOIN public.person_documents pd ON pd.id = ad.person_document_id
        WHERE ad.accreditation_id = v_accred.id
          AND pd.doc_type = v_doc_type AND ad.unlinked_at IS NOT NULL
      ) INTO v_unlinked;

      IF v_unlinked THEN
        n_unlinked := n_unlinked + 1;
        RETURN QUERY SELECT v_accred.id, v_accred.full_name, v_game_name, v_doc_type, false, 'Délié par l''utilisateur'::text;
        CONTINUE;
      END IF;

      v_best_id := NULL;
      SELECT pd.id INTO v_best_id
      FROM public.person_documents pd
      WHERE pd.person_id = v_accred.person_id
        AND pd.doc_type  = v_doc_type
        AND pd.status    = 'valid'
    ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
      LIMIT 1;

      IF v_best_id IS NULL THEN
        n_nodoc := n_nodoc + 1;
        RETURN QUERY SELECT v_accred.id, v_accred.full_name, v_game_name, v_doc_type, false, 'Aucun document valide'::text;
      ELSE
        n_link := n_link + 1;
        IF NOT p_dry_run THEN
          INSERT INTO public.accreditation_documents (
            accreditation_id, person_document_id, status, uploaded_at
          ) VALUES (v_accred.id, v_best_id, 'pending', now());
        END IF;
        RETURN QUERY SELECT v_accred.id, v_accred.full_name, v_game_name, v_doc_type, true,
          CASE WHEN p_dry_run THEN 'Sera lié (dry run)'::text ELSE 'Liaison créée (pending)'::text END;
      END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT
    NULL::uuid, 'SYNTHÈSE'::text,
    CASE WHEN p_dry_run THEN 'DRY RUN'::text ELSE 'EXÉCUTION'::text END,
    NULL::text, (n_link > 0),
    format('À lier: %s · Déjà liés: %s · Déliés: %s · Sans doc: %s',
           n_link, n_already, n_unlinked, n_nodoc)::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_all_existing_docs(boolean) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Backfill role_code (AFFICHAGE uniquement)
--    Priorité : athlete > coach > president > secretary_general
--               > press > vip > medical > official
--    NOTE : ::text obligatoire sur pr.role_type (enum person_role_type)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.accreditations a
SET role_code = sub.resolved
FROM (
  SELECT
    a2.id,
    COALESCE(
      CASE WHEN EXISTS (
        SELECT 1 FROM public.person_roles pr
        WHERE pr.person_id = a2.person_id AND pr.is_active = true
          AND pr.role_type::text = 'athlete'
      ) THEN 'athlete' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.person_roles pr
        JOIN public.coach_profiles cp ON cp.person_id = pr.person_id AND cp.is_active = true
        LEFT JOIN public.role_accreditation_mapping ram
          ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE pr.person_id = a2.person_id AND pr.is_active = true
          AND pr.role_type::text = 'coach'
          AND COALESCE(ram.accreditation_category, 'coach') = 'coach'
      ) THEN 'coach' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.federation_member_profiles fmp
        JOIN public.role_accreditation_mapping ram
          ON ram.source_group = 'federation_member_roles' AND ram.source_code = fmp.role
        WHERE fmp.person_id = a2.person_id AND fmp.is_active = true
          AND ram.accreditation_category = 'president'
      ) THEN 'president' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.federation_member_profiles fmp
        JOIN public.role_accreditation_mapping ram
          ON ram.source_group = 'federation_member_roles' AND ram.source_code = fmp.role
        WHERE fmp.person_id = a2.person_id AND fmp.is_active = true
          AND ram.accreditation_category = 'secretary_general'
      ) THEN 'secretary_general' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.coach_profiles cp
        JOIN public.role_accreditation_mapping ram
          ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE cp.person_id = a2.person_id AND cp.is_active = true
          AND ram.accreditation_category = 'press'
      ) THEN 'press' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.coach_profiles cp
        JOIN public.role_accreditation_mapping ram
          ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE cp.person_id = a2.person_id AND cp.is_active = true
          AND ram.accreditation_category = 'vip'
      ) THEN 'vip' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.coach_profiles cp
        JOIN public.role_accreditation_mapping ram
          ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE cp.person_id = a2.person_id AND cp.is_active = true
          AND ram.accreditation_category = 'medical'
      ) THEN 'medical' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.person_roles pr
        WHERE pr.person_id = a2.person_id AND pr.is_active = true
      ) THEN 'official' END,
      a2.role_code
    ) AS resolved
  FROM public.accreditations a2
  WHERE a2.role_code IS NULL
) sub
WHERE a.id = sub.id AND a.role_code IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. sync_accreditations_for_game : ON CONFLICT DO UPDATE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_accreditations_for_game(p_game_id uuid)
RETURNS TABLE(selection_id uuid, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller     text;
  sel          RECORD;
  v_person_id  uuid;
  v_full_name  text;
  v_role_code  text;
  v_coach_role text;
  v_fed_role   text;
  v_mapped     text;
BEGIN
  v_caller := public.get_current_user_role();
  IF v_caller IS NULL OR v_caller NOT IN ('admin', 'games_manager') THEN
    RAISE EXCEPTION 'Accès refusé : rôle % non autorisé', COALESCE(v_caller, 'inconnu');
  END IF;

  FOR sel IN
    SELECT s.id, s.athlete_id, s.person_id
    FROM public.selections s
    WHERE s.game_id = p_game_id
      AND s.status::text IN ('pre_selected', 'selected', 'reserve')
  LOOP
    v_person_id  := sel.person_id;
    v_role_code  := 'athlete';
    v_coach_role := NULL;
    v_fed_role   := NULL;
    v_mapped     := NULL;

    IF v_person_id IS NULL AND sel.athlete_id IS NOT NULL THEN
      SELECT ap.person_id INTO v_person_id
      FROM public.athlete_profiles ap
      WHERE ap.legacy_athlete_id = sel.athlete_id LIMIT 1;

      IF v_person_id IS NULL THEN
        SELECT ath.person_id INTO v_person_id
        FROM public.athletes ath WHERE ath.id = sel.athlete_id LIMIT 1;
      END IF;
    END IF;

    IF v_person_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT (p.first_name || ' ' || p.last_name) INTO v_full_name
    FROM public.persons p WHERE p.id = v_person_id;

    IF sel.athlete_id IS NULL THEN
      SELECT cp.role INTO v_coach_role
      FROM public.coach_profiles cp
      WHERE cp.person_id = v_person_id AND cp.is_active = true LIMIT 1;

      IF v_coach_role IS NOT NULL THEN
        SELECT ram.accreditation_category INTO v_mapped
        FROM public.role_accreditation_mapping ram
        WHERE ram.source_group = 'coach_roles' AND ram.source_code = v_coach_role;
        v_role_code := COALESCE(v_mapped, 'coach');
      ELSE
        SELECT fmp.role INTO v_fed_role
        FROM public.federation_member_profiles fmp
        WHERE fmp.person_id = v_person_id AND fmp.is_active = true LIMIT 1;

        IF v_fed_role IS NOT NULL THEN
          SELECT ram.accreditation_category INTO v_mapped
          FROM public.role_accreditation_mapping ram
          WHERE ram.source_group = 'federation_member_roles' AND ram.source_code = v_fed_role;
          v_role_code := COALESCE(v_mapped, 'official');
        END IF;
      END IF;
    END IF;

    INSERT INTO public.accreditations (game_id, person_id, full_name, status, role_code)
    VALUES (p_game_id, v_person_id, COALESCE(v_full_name, ''), 'draft', v_role_code)
    ON CONFLICT (game_id, person_id) WHERE person_id IS NOT NULL
    DO UPDATE SET
      role_code = EXCLUDED.role_code,
      full_name = EXCLUDED.full_name;
  END LOOP;

  RETURN QUERY
  SELECT s.id, 'Pas de person_id résolu'::text
  FROM public.selections s
  WHERE s.game_id = p_game_id
    AND s.status::text IN ('pre_selected', 'selected', 'reserve')
    AND s.person_id IS NULL
    AND s.athlete_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.athlete_profiles ap
                    WHERE ap.legacy_athlete_id = s.athlete_id AND ap.person_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.athletes ath
                    WHERE ath.id = s.athlete_id AND ath.person_id IS NOT NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_accreditations_for_game(uuid) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0065', 'get_required_doc_types_auto_link_backfill_role_code')
ON CONFLICT (version) DO NOTHING;

COMMIT;