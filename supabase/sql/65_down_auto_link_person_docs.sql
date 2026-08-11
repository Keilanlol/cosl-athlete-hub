-- ============================================================================
-- 65 DOWN. Rollback de la migration 65
-- ============================================================================

BEGIN;

-- ── Supprimer les triggers ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_auto_link_person_docs_insert ON public.person_documents;
DROP TRIGGER IF EXISTS trg_auto_link_person_docs_update ON public.person_documents;

-- ── Supprimer les fonctions et RPC ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.auto_link_person_docs();
DROP FUNCTION IF EXISTS public.link_available_docs(uuid);
DROP FUNCTION IF EXISTS public.link_all_existing_docs(boolean);
DROP FUNCTION IF EXISTS public.get_required_doc_types(uuid, uuid);

-- ── Supprimer l'index ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_accred_docs_accred_person_doc;

-- ── Restaurer les accreditation_documents depuis le snapshot ────────────────
DELETE FROM public.accreditation_documents
WHERE id NOT IN (SELECT id FROM migration_backups.migration_65_snapshot_accreditation_documents);

INSERT INTO public.accreditation_documents (
  id, accreditation_id, person_document_id, status, uploaded_at, unlinked_at
)
SELECT
  s.id, s.accreditation_id, s.person_document_id, s.status, s.uploaded_at, NULL
FROM migration_backups.migration_65_snapshot_accreditation_documents s
WHERE s.id NOT IN (SELECT id FROM public.accreditation_documents)
ON CONFLICT (id) DO NOTHING;

-- ── Supprimer la colonne unlinked_at ────────────────────────────────────────
ALTER TABLE public.accreditation_documents DROP COLUMN IF EXISTS unlinked_at;

-- ── Restaurer la vue (version migration 61, sans get_required_doc_types) ───
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
        OR EXISTS (
          SELECT 1
          FROM public.selections s
          WHERE s.game_id = a.game_id
            AND s.person_id = a.person_id
            AND s.status::text = ar.selection_stage
            AND s.status IN ('pre_selected', 'selected', 'reserve')
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

-- ── Restaurer role_code depuis le snapshot ──────────────────────────────────
UPDATE public.accreditations a
SET role_code = snap.role_code
FROM migration_backups.migration_65_snapshot_accreditations snap
WHERE a.id = snap.id
  AND a.role_code IS DISTINCT FROM snap.role_code;

-- ── Restaurer sync_accreditations_for_game (version migration 60 sans ON CONFLICT UPDATE) ──
-- On recrée la version de la migration 60 (avec garde de rôle, sans ON CONFLICT DO UPDATE)
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

-- ── Retirer la migration du tracking ────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0065';

COMMIT;