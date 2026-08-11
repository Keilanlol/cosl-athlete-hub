-- ============================================================================
-- 65 UP. Fonction SQL unique + liaison automatique + backfill role_code
-- ============================================================================
-- 1. Fonction get_required_doc_types(p_person_id, p_game_id) : SOURCE UNIQUE
--    Dérive les catégories depuis person_roles + role_accreditation_mapping,
--    applique l'union des stages actifs, retourne les doc_type_code requis
--    avec leurs provenances (rôle + discipline + stage).
-- 2. Colonne unlinked_at sur accreditation_documents
-- 3. Index sur accreditation_documents(accreditation_id, person_document_id)
-- 4. Trigger auto_link_person_docs() sur person_documents (AFTER INSERT/UPDATE)
-- 5. RPC link_available_docs(p_accreditation_id) — bouton explicite du drawer
-- 6. RPC link_all_existing_docs(p_dry_run) — rattrapage des accréditations existantes
-- 7. Backfill de accreditations.role_code pour les lignes NULL
-- 8. Correction de sync_accreditations_for_game : ON CONFLICT DO UPDATE
-- ============================================================================
-- RÈGLES :
--   - get_required_doc_types est STABLE : peut être appelée depuis une vue.
--   - Le trigger ne se déclenche QUE pour NEW.status = 'valid'.
--   - Le trigger crée TOUJOURS accreditation_documents.status = 'pending'.
--   - Le trigger n'écrase jamais un document déjà lié et non délié.
--   - Le trigger respecte unlinked_at (intention de déliage persistante).
--   - role_code est un champ d'AFFICHAGE uniquement, jamais utilisé pour le
--     calcul des requirements. La priorité d'affichage est :
--     athlete > coach > official > president > secretary_general > press > vip > medical
--
-- RÉCURSION :
--   Ce trigger écrit dans accreditation_documents. Aucun trigger n'existe sur
--   accreditation_documents (vérifié dans toutes les migrations 00 à 64).
--   ⚠️ CONTRAINTE : toute future migration ajoutant un trigger sur
--   accreditation_documents qui écrirait dans person_documents créerait une
--   boucle infinie. Ne pas le faire.
-- ============================================================================

BEGIN;

-- ── Snapshot avant modification ─────────────────────────────────────────────
DROP TABLE IF EXISTS migration_backups.migration_65_snapshot_accreditation_documents;
CREATE TABLE migration_backups.migration_65_snapshot_accreditation_documents AS
  SELECT * FROM public.accreditation_documents;

DROP TABLE IF EXISTS migration_backups.migration_65_snapshot_accreditations;
CREATE TABLE migration_backups.migration_65_snapshot_accreditations AS
  SELECT id, role_code FROM public.accreditations;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. FONCTION get_required_doc_types — SOURCE UNIQUE SQL
-- ════════════════════════════════════════════════════════════════════════════
-- Dérive les catégories d'accréditation depuis person_roles + profils,
-- résolues via role_accreditation_mapping. Applique l'union des stages actifs.
-- Retourne les doc_type_code requis avec leurs provenances (rôle + discipline + stage).
-- Même logique que le frontend getPersonAccreditationCategories + computeRequiredDocsMultiRole.

CREATE OR REPLACE FUNCTION public.get_required_doc_types(
  p_person_id uuid,
  p_game_id uuid
)
RETURNS TABLE(
  doc_type_code text,
  role_label text,
  discipline_name text,
  stage_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_role_type text;
  v_coach_role text;
  v_fed_role text;
  v_category text;
  v_cat_label text;
BEGIN
  -- Parcourir les rôles actifs de la personne, par ordre de priorité d'affichage
  FOR v_role_type IN
    SELECT pr.role_type
    FROM public.person_roles pr
    WHERE pr.person_id = p_person_id
      AND pr.is_active = true
    ORDER BY
      CASE pr.role_type
        WHEN 'athlete' THEN 1
        WHEN 'coach' THEN 2
        WHEN 'federation_member' THEN 3
        WHEN 'official' THEN 4
        WHEN 'volunteer' THEN 5
        WHEN 'staff' THEN 6
        ELSE 99
      END
  LOOP
    -- Résoudre la catégorie d'accréditation selon le type de rôle
    v_category := NULL;

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
        WHERE ram.source_group = 'coach_roles' AND ram.source_code = v_coach_role;
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
        WHERE ram.source_group = 'federation_member_roles' AND ram.source_code = v_fed_role;
      END IF;
      v_category := COALESCE(v_category, 'official');
    ELSE
      SELECT ram.accreditation_category INTO v_category
      FROM public.role_accreditation_mapping ram
      WHERE ram.source_group = 'person_role_types' AND ram.source_code = v_role_type;
      v_category := COALESCE(v_category, 'official');
    END IF;

    -- Libellé de la catégorie
    SELECT ati.label INTO v_cat_label
    FROM public.app_type_items ati
    WHERE ati.group_key = 'accreditation_categories' AND ati.code = v_category;
    v_cat_label := COALESCE(v_cat_label, v_category);

    -- 1. Requirements sans stage (toujours exigés)
    RETURN QUERY
    SELECT
      ar.doc_type_code,
      v_cat_label,
      NULL::text,
      'Toutes étapes'::text
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = p_game_id
      AND ar.role_code = v_category
      AND ar.required = true
      AND ar.selection_stage IS NULL;

    -- 2. Requirements avec stage actif (union)
    -- Pour chaque sélection active de la personne à ce stage, retourner une ligne
    -- avec la discipline correspondante
    RETURN QUERY
    SELECT
      ar.doc_type_code,
      v_cat_label,
      COALESCE(d.name, sp.name),
      ar.selection_stage
    FROM public.accreditation_requirements ar
    JOIN public.selections sel ON
      sel.game_id = p_game_id
      AND sel.person_id = p_person_id
      AND sel.status::text = ar.selection_stage
      AND sel.status IN ('pre_selected', 'selected', 'reserve')
    LEFT JOIN public.sports sp ON sp.id = sel.sport_id
    LEFT JOIN public.disciplines d ON d.id = sel.discipline_id
    WHERE ar.game_id = p_game_id
      AND ar.role_code = v_category
      AND ar.required = true
      AND ar.selection_stage IS NOT NULL;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_required_doc_types(uuid, uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Colonne unlinked_at
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.accreditation_documents
  ADD COLUMN IF NOT EXISTS unlinked_at timestamptz;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Index sur accreditation_documents(accreditation_id, person_document_id)
-- ════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_accred_docs_accred_person_doc
  ON public.accreditation_documents (accreditation_id, person_document_id)
  WHERE person_document_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Trigger auto_link_person_docs()
-- ════════════════════════════════════════════════════════════════════════════
-- Se déclenche après INSERT (status='valid') ou UPDATE (passage à 'valid').
-- Pour chaque accréditation de la personne, appelle get_required_doc_types
-- pour vérifier si NEW.doc_type est requis. Si oui et pas déjà lié (ou délié),
-- crée une liaison en status='pending'.

CREATE OR REPLACE FUNCTION public.auto_link_person_docs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accred RECORD;
  v_is_required boolean;
  v_existing RECORD;
BEGIN
  -- Ne se déclencher que pour les documents valides
  IF NEW.status <> 'valid' THEN
    RETURN NEW;
  END IF;

  -- Parcourir les accréditations de cette personne
  FOR v_accred IN
    SELECT a.id, a.game_id
    FROM public.accreditations a
    WHERE a.person_id = NEW.person_id
  LOOP
    -- Vérifier si NEW.doc_type est requis pour cette personne sur ce game
    -- (en utilisant la fonction source unique)
    SELECT EXISTS(
      SELECT 1 FROM public.get_required_doc_types(NEW.person_id, v_accred.game_id)
      WHERE doc_type_code = NEW.doc_type
    ) INTO v_is_required;

    IF NOT v_is_required THEN
      CONTINUE;
    END IF;

    -- Vérifier s'il existe déjà une liaison non déliée pour ce doc_type
    SELECT ad.id, ad.person_document_id, ad.status, pd.created_at AS doc_created_at
    INTO v_existing
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = v_accred.id
      AND pd.doc_type = NEW.doc_type
      AND ad.unlinked_at IS NULL
    ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- Ne pas écraser. Signaler si plus récent.
      IF NEW.created_at > v_existing.doc_created_at AND v_existing.person_document_id <> NEW.id THEN
        INSERT INTO public.notifications (
          notification_type, message,
          related_game_id, related_person_id, related_doc_type, is_read
        )
        VALUES (
          'document_action_required',
          'Document plus récent disponible pour le type ' || NEW.doc_type || ' — à examiner depuis l''onglet Accréditations',
          v_accred.game_id, NEW.person_id, NEW.doc_type, false
        );
      END IF;
      CONTINUE;
    END IF;

    -- Vérifier s'il existe une liaison déliée (respecter l'intention)
    PERFORM 1
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = v_accred.id
      AND pd.doc_type = NEW.doc_type
      AND ad.unlinked_at IS NOT NULL
    LIMIT 1;

    IF FOUND THEN
      CONTINUE;
    END IF;

    -- Créer la liaison en pending (jamais valid — la validation est humaine)
    INSERT INTO public.accreditation_documents (
      accreditation_id, person_document_id, status, uploaded_at
    )
    VALUES (v_accred.id, NEW.id, 'pending', now());
  END LOOP;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_link_person_docs() TO authenticated;

DROP TRIGGER IF EXISTS trg_auto_link_person_docs_insert ON public.person_documents;
CREATE TRIGGER trg_auto_link_person_docs_insert
  AFTER INSERT ON public.person_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_person_docs();

DROP TRIGGER IF EXISTS trg_auto_link_person_docs_update ON public.person_documents;
CREATE TRIGGER trg_auto_link_person_docs_update
  AFTER UPDATE ON public.person_documents
  FOR EACH ROW
  WHEN (NEW.status = 'valid' AND (OLD.status IS DISTINCT FROM NEW.status))
  EXECUTE FUNCTION public.auto_link_person_docs();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. RPC link_available_docs(p_accreditation_id) — bouton du drawer
-- ════════════════════════════════════════════════════════════════════════════
-- Force la liaison des documents valides pour les types requis non encore liés.
-- Utilise get_required_doc_types pour connaître les doc_types requis.
-- Respecte unlinked_at. Crée en status='pending'.

CREATE OR REPLACE FUNCTION public.link_available_docs(p_accreditation_id uuid)
RETURNS TABLE(doc_type_code text, linked boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accred RECORD;
  v_doc_type text;
  v_best_doc RECORD;
  v_existing RECORD;
BEGIN
  SELECT a.id, a.game_id, a.person_id
  INTO v_accred
  FROM public.accreditations a
  WHERE a.id = p_accreditation_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, false, 'Accréditation introuvable'::text;
    RETURN;
  END IF;

  -- Parcourir les doc_types requis (source unique)
  FOR v_doc_type IN
    SELECT DISTINCT rdt.doc_type_code
    FROM public.get_required_doc_types(v_accred.person_id, v_accred.game_id) rdt
  LOOP
    -- Liaison non déliée existante ?
    SELECT ad.id INTO v_existing
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = p_accreditation_id
      AND pd.doc_type = v_doc_type
      AND ad.unlinked_at IS NULL
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT v_doc_type, false, 'Déjà lié'::text;
      CONTINUE;
    END IF;

    -- Liaison déliée ?
    PERFORM 1
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = p_accreditation_id
      AND pd.doc_type = v_doc_type
      AND ad.unlinked_at IS NOT NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT v_doc_type, false, 'Délié par l''utilisateur'::text;
      CONTINUE;
    END IF;

    -- Meilleur document valide
    SELECT pd.id INTO v_best_doc
    FROM public.person_documents pd
    WHERE pd.person_id = v_accred.person_id
      AND pd.doc_type = v_doc_type
      AND pd.status = 'valid'
    ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
    LIMIT 1;

    IF v_best_doc IS NULL THEN
      RETURN QUERY SELECT v_doc_type, false, 'Aucun document valide disponible'::text;
    ELSE
      INSERT INTO public.accreditation_documents (
        accreditation_id, person_document_id, status, uploaded_at
      )
      VALUES (p_accreditation_id, v_best_doc.id, 'pending', now());
      RETURN QUERY SELECT v_doc_type, true, 'Liaison créée (pending)'::text;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_available_docs(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RPC link_all_existing_docs(p_dry_run) — rattrapage
-- ════════════════════════════════════════════════════════════════════════════
-- Passe de rattrapage exécutable manuellement. En dry_run, ne crée rien.
-- Utilise get_required_doc_types. Respecte unlinked_at. Crée en 'pending'.
-- Réservée aux rôles admin / games_manager.

CREATE OR REPLACE FUNCTION public.link_all_existing_docs(
  p_dry_run boolean DEFAULT true
)
RETURNS TABLE(
  accreditation_id uuid,
  full_name text,
  game_short_name text,
  doc_type_code text,
  would_link boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role text;
  v_accred RECORD;
  v_doc_type text;
  v_best_doc RECORD;
  v_existing RECORD;
  v_game_name text;
  v_total_to_link int := 0;
  v_total_already_linked int := 0;
  v_total_unlinked int := 0;
  v_total_no_doc int := 0;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'games_manager') THEN
    RAISE EXCEPTION 'Accès refusé : rôle % non autorisé', v_caller_role;
  END IF;

  FOR v_accred IN
    SELECT a.id, a.game_id, a.person_id, a.full_name
    FROM public.accreditations a
    WHERE a.person_id IS NOT NULL
    ORDER BY a.full_name
  LOOP
    SELECT g.short_name INTO v_game_name
    FROM public.games g WHERE g.id = v_accred.game_id;
    v_game_name := COALESCE(v_game_name, v_accred.game_id::text);

    FOR v_doc_type IN
      SELECT DISTINCT rdt.doc_type_code
      FROM public.get_required_doc_types(v_accred.person_id, v_accred.game_id) rdt
    LOOP
      -- Liaison non déliée existante ?
      SELECT ad.id INTO v_existing
      FROM public.accreditation_documents ad
      JOIN public.person_documents pd ON pd.id = ad.person_document_id
      WHERE ad.accreditation_id = v_accred.id
        AND pd.doc_type = v_doc_type
        AND ad.unlinked_at IS NULL
      LIMIT 1;

      IF v_existing IS NOT NULL THEN
        v_total_already_linked := v_total_already_linked + 1;
        RETURN QUERY SELECT v_accred.id, v_accred.full_name, v_game_name, v_doc_type, false, 'Déjà lié'::text;
        CONTINUE;
      END IF;

      -- Liaison déliée ?
      PERFORM 1
      FROM public.accreditation_documents ad
      JOIN public.person_documents pd ON pd.id = ad.person_document_id
      WHERE ad.accreditation_id = v_accred.id
        AND pd.doc_type = v_doc_type
        AND ad.unlinked_at IS NOT NULL
      LIMIT 1;

      IF FOUND THEN
        v_total_unlinked := v_total_unlinked + 1;
        RETURN QUERY SELECT v_accred.id, v_accred.full_name, v_game_name, v_doc_type, false, 'Délié par l''utilisateur'::text;
        CONTINUE;
      END IF;

      -- Meilleur document valide
      SELECT pd.id INTO v_best_doc
      FROM public.person_documents pd
      WHERE pd.person_id = v_accred.person_id
        AND pd.doc_type = v_doc_type
        AND pd.status = 'valid'
      ORDER BY pd.issued_date DESC NULLS LAST, pd.created_at DESC
      LIMIT 1;

      IF v_best_doc IS NULL THEN
        v_total_no_doc := v_total_no_doc + 1;
        RETURN QUERY SELECT v_accred.id, v_accred.full_name, v_game_name, v_doc_type, false, 'Aucun document valide'::text;
      ELSE
        v_total_to_link := v_total_to_link + 1;
        IF NOT p_dry_run THEN
          INSERT INTO public.accreditation_documents (
            accreditation_id, person_document_id, status, uploaded_at
          )
          VALUES (v_accred.id, v_best_doc.id, 'pending', now());
        END IF;
        RETURN QUERY SELECT
          v_accred.id, v_accred.full_name, v_game_name, v_doc_type, true,
          CASE WHEN p_dry_run THEN 'Sera lié (dry run)'::text ELSE 'Liaison créée (pending)'::text END;
      END IF;
    END LOOP;
  END LOOP;

  -- Ligne de synthèse
  RETURN QUERY SELECT
    NULL::uuid, 'SYNTHÈSE'::text,
    CASE WHEN p_dry_run THEN 'DRY RUN'::text ELSE 'EXÉCUTION'::text END,
    NULL::text, v_total_to_link > 0,
    format('À lier: %s · Déjà liés: %s · Déliés: %s · Sans doc: %s',
      v_total_to_link, v_total_already_linked, v_total_unlinked, v_total_no_doc)::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_all_existing_docs(boolean) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Backfill de accreditations.role_code pour les lignes NULL
-- ════════════════════════════════════════════════════════════════════════════
-- role_code est un champ d'AFFICHAGE uniquement. Il n'est PAS utilisé par
-- get_required_doc_types pour le calcul des requirements (qui dérive tout
-- depuis person_roles). On le renseigne néanmoins pour l'affichage dans le
-- tableau des accréditations et l'export CSV.
--
-- Priorité d'affichage (ordre de résolution) :
--   athlete > coach > official > president > secretary_general > press > vip > medical
-- On prend la première catégorie trouvée selon cet ordre.

UPDATE public.accreditations a
SET role_code = sub.resolved_category
FROM (
  SELECT
    a2.id,
    COALESCE(
      -- athlete
      CASE WHEN EXISTS (
        SELECT 1 FROM public.person_roles pr
        WHERE pr.person_id = a2.person_id AND pr.is_active = true AND pr.role_type = 'athlete'
      ) THEN 'athlete' END,
      -- coach (résolu via role_accreditation_mapping)
      CASE WHEN EXISTS (
        SELECT 1 FROM public.person_roles pr
        JOIN public.coach_profiles cp ON cp.person_id = pr.person_id AND cp.is_active = true
        JOIN public.role_accreditation_mapping ram ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE pr.person_id = a2.person_id AND pr.is_active = true AND pr.role_type = 'coach'
          AND ram.accreditation_category = 'coach'
      ) THEN 'coach' END,
      -- official
      CASE WHEN EXISTS (
        SELECT 1 FROM public.person_roles pr
        LEFT JOIN public.role_accreditation_mapping ram ON ram.source_group = 'person_role_types' AND ram.source_code = pr.role_type
        WHERE pr.person_id = a2.person_id AND pr.is_active = true
          AND COALESCE(ram.accreditation_category, 'official') = 'official'
      ) THEN 'official' END,
      -- president
      CASE WHEN EXISTS (
        SELECT 1 FROM public.federation_member_profiles fmp
        JOIN public.role_accreditation_mapping ram ON ram.source_group = 'federation_member_roles' AND ram.source_code = fmp.role
        WHERE fmp.person_id = a2.person_id AND fmp.is_active = true
          AND ram.accreditation_category = 'president'
      ) THEN 'president' END,
      -- secretary_general
      CASE WHEN EXISTS (
        SELECT 1 FROM public.federation_member_profiles fmp
        JOIN public.role_accreditation_mapping ram ON ram.source_group = 'federation_member_roles' AND ram.source_code = fmp.role
        WHERE fmp.person_id = a2.person_id AND fmp.is_active = true
          AND ram.accreditation_category = 'secretary_general'
      ) THEN 'secretary_general' END,
      -- press
      CASE WHEN EXISTS (
        SELECT 1 FROM public.coach_profiles cp
        JOIN public.role_accreditation_mapping ram ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE cp.person_id = a2.person_id AND cp.is_active = true
          AND ram.accreditation_category = 'press'
      ) THEN 'press' END,
      -- vip
      CASE WHEN EXISTS (
        SELECT 1 FROM public.coach_profiles cp
        JOIN public.role_accreditation_mapping ram ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE cp.person_id = a2.person_id AND cp.is_active = true
          AND ram.accreditation_category = 'vip'
      ) THEN 'vip' END,
      -- medical
      CASE WHEN EXISTS (
        SELECT 1 FROM public.coach_profiles cp
        JOIN public.role_accreditation_mapping ram ON ram.source_group = 'coach_roles' AND ram.source_code = cp.role
        WHERE cp.person_id = a2.person_id AND cp.is_active = true
          AND ram.accreditation_category = 'medical'
      ) THEN 'medical' END,
      -- fallback : si aucun person_roles, garder le role_code existant
      a2.role_code
    ) AS resolved_category
  FROM public.accreditations a2
  WHERE a2.role_code IS NULL
) sub
WHERE a.id = sub.id
  AND a.role_code IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Correction de sync_accreditations_for_game : ON CONFLICT DO UPDATE
-- ════════════════════════════════════════════════════════════════════════════
-- La fonction existante fait INSERT ... ON CONFLICT DO NOTHING, ce qui ne
-- met jamais à jour role_code ni full_name si l'accréditation existe déjà.
-- On recrée la fonction avec ON CONFLICT DO UPDATE.

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

    -- INSERT avec ON CONFLICT DO UPDATE : met à jour role_code et full_name
    INSERT INTO public.accreditations (game_id, person_id, full_name, status, role_code)
    VALUES (p_game_id, v_person_id, v_full_name, 'draft', v_role_code)
    ON CONFLICT (game_id, person_id) WHERE person_id IS NOT NULL
    DO UPDATE SET
      role_code = EXCLUDED.role_code,
      full_name = EXCLUDED.full_name;

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

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0065', 'get_required_doc_types_auto_link_backfill_role_code')
ON CONFLICT (version) DO NOTHING;

COMMIT;