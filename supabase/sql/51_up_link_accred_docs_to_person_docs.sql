-- ============================================================================
-- 51 UP. Lier accreditation_documents à person_documents
-- ============================================================================
-- 1. Ajouter person_document_id (FK vers person_documents, ON DELETE SET NULL)
-- 2. Backfill : rattacher les accreditation_documents existants à leur
--    person_documents via (person_id de l'accréditation, doc_type, file_url)
-- 3. Conserver file_name, file_url et status (Option A : statut propre à
--    accreditation_documents). Les colonnes redondantes seront supprimées
--    dans la migration 0052 après validation du backfill.
-- ============================================================================

-- ── 1. Snapshot avant modification ──────────────────────────────────────────
DROP TABLE IF EXISTS migration_51_snapshot_accreditation_documents;
CREATE TABLE migration_51_snapshot_accreditation_documents AS
  SELECT * FROM public.accreditation_documents;

-- ── 2. Ajouter la colonne person_document_id ────────────────────────────────
ALTER TABLE public.accreditation_documents
  ADD COLUMN IF NOT EXISTS person_document_id uuid
  REFERENCES public.person_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accred_docs_person_doc
  ON public.accreditation_documents (person_document_id)
  WHERE person_document_id IS NOT NULL;

-- ── 3. Backfill : rapprocher via (person_id, doc_type, file_url) ─────────────
UPDATE public.accreditation_documents ad
SET person_document_id = pd.id
FROM public.accreditations a
JOIN public.person_documents pd
  ON pd.person_id = a.person_id
  AND pd.doc_type = ad.doc_type
  AND pd.file_url = ad.file_url
WHERE ad.accreditation_id = a.id
  AND ad.person_document_id IS NULL;

-- ── 4. Vérification du backfill ─────────────────────────────────────────────
-- À exécuter par l'utilisateur :
-- SELECT
--   count(*) FILTER (WHERE person_document_id IS NOT NULL) AS linked,
--   count(*) FILTER (WHERE person_document_id IS NULL) AS unlinked
-- FROM public.accreditation_documents;
-- Résultat attendu : linked = 1, unlinked = 84 (les 84 lignes legacy
-- n'ont pas de person_documents correspondant — les champs ont été recopiés
-- sans créer l'enregistrement source).

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0051', 'link_accreditation_documents_to_person_documents')
ON CONFLICT (version) DO NOTHING;