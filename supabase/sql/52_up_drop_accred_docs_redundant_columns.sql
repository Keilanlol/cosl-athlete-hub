-- ============================================================================
-- 52 UP. Supprimer les colonnes redondantes d'accreditation_documents
-- ============================================================================
-- Après validation du backfill (migration 0051), les colonnes file_name et
-- file_url sont redondantes : le fichier est lu via la jointure vers
-- person_documents. On les supprime.
--
-- ⚠️ À exécuter uniquement après avoir vérifié que le backfill est correct
--    et que le code lit les fichiers via person_document_id.
-- ============================================================================

-- ── 1. Vérification préalable (à exécuter par l'utilisateur) ────────────────
-- Avant de supprimer, vérifier qu'il ne reste pas trop de lignes non liées
-- qui perdraient leur fichier :
-- SELECT count(*) AS unlinked_with_file
-- FROM public.accreditation_documents
-- WHERE person_document_id IS NULL
--   AND file_url IS NOT NULL;
-- Si ce nombre est élevé, NE PAS exécuter cette migration.

-- ── 2. Supprimer les colonnes redondantes ───────────────────────────────────
ALTER TABLE public.accreditation_documents DROP COLUMN IF EXISTS file_name;
ALTER TABLE public.accreditation_documents DROP COLUMN IF EXISTS file_url;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0052', 'drop_accreditation_documents_redundant_columns')
ON CONFLICT (version) DO NOTHING;