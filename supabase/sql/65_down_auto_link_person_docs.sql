-- ============================================================================
-- 65 DOWN. Rollback de la migration 65
-- ============================================================================

BEGIN;

-- ── Supprimer les triggers ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_auto_link_person_docs_insert ON public.person_documents;
DROP TRIGGER IF EXISTS trg_auto_link_person_docs_update ON public.person_documents;

-- ── Supprimer la fonction trigger ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.auto_link_person_docs();

-- ── Supprimer la RPC link_available_docs ────────────────────────────────────
DROP FUNCTION IF EXISTS public.link_available_docs(uuid);

-- ── Supprimer la RPC link_all_existing_docs ──────────────────────────────────
DROP FUNCTION IF EXISTS public.link_all_existing_docs(boolean);

-- ── Supprimer l'index ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_accred_docs_accred_person_doc;

-- ── Restaurer les accreditation_documents depuis le snapshot ────────────────
-- (annule les liaisons créées par le trigger, restaure unlinked_at à NULL)
DELETE FROM public.accreditation_documents
WHERE id NOT IN (SELECT id FROM migration_backups.migration_65_snapshot_accreditation_documents);

-- Restaurer les lignes supprimées par le trigger (si le snapshot a des lignes absentes)
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

-- ── Restaurer la vue sans le filtre unlinked_at (version migration 61) ──────
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

-- ── Retirer la migration du tracking ────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0065';

COMMIT;