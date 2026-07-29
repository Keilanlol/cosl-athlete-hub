-- ============================================================================
-- 55 UP. Vue SQL de complétude des accréditations
-- ============================================================================
-- Calcule pour chaque accréditation le nombre de documents requis et le
-- nombre de documents fournis (valides et non expirés), en tenant compte
-- de l'étape de sélection pour les athlètes.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_accreditation_completeness AS
SELECT
  a.id AS accreditation_id,
  a.game_id,
  a.person_id,
  a.role_code,
  -- Nombre total de documents requis pour ce rôle et cette étape
  (
    SELECT count(DISTINCT ar.doc_type_code)
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = a.game_id
      AND ar.role_code = a.role_code
      AND ar.required = true
      AND (
        ar.selection_stage IS NULL
        OR ar.selection_stage = (
          SELECT s.status FROM public.selections s
          WHERE s.game_id = a.game_id
            AND (s.person_id = a.person_id OR s.athlete_id = a.athlete_id)
            AND s.status IN ('pre_selected', 'selected', 'reserve')
          ORDER BY s.status DESC
          LIMIT 1
        )
      )
  ) AS required_count,
  -- Nombre de documents fournis : accreditation_documents liées avec statut valide
  -- et dont le person_documents lié a un statut valide et n'est pas expiré
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

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0055', 'accreditation_completeness_view')
ON CONFLICT (version) DO NOTHING;