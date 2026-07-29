-- ============================================================================
-- 53 UP. Simplifier accreditation_documents en table de liaison pure
-- ============================================================================
-- accreditation_documents devient une simple liaison entre accreditation
-- et person_documents. On supprime doc_type, file_name, file_url qui étaient
-- des recopies. Les informations du fichier sont lues via person_document_id.
--
-- ⚠️ À exécuter après la migration 0051 (person_document_id ajouté) et
--    après validation que le code lit les fichiers via person_document_id.
-- ============================================================================

-- ── 1. Vérification préalable ───────────────────────────────────────────────
-- Avant de supprimer doc_type, s'assurer que toutes les lignes ont un
-- person_document_id (sinon on perd l'information du type de document)
-- À exécuter par l'utilisateur :
-- SELECT count(*) AS unlinked FROM accreditation_documents WHERE person_document_id IS NULL;
-- Si > 0, ces lignes perdront leur référence de type. C'est acceptable pour
-- les lignes legacy (84 lignes non résolues au backfill).

-- ── 2. Rendre person_document_id NOT NULL pour les nouvelles lignes ─────────
-- Les lignes legacy sans person_document_id restent telles quelles (NULL).
-- On ne force pas NOT NULL car les 84 lignes legacy n'ont pas de lien.
-- Le code garantit que les nouvelles lignes ont toujours person_document_id.

-- ── 3. Supprimer les colonnes redondantes ───────────────────────────────────
ALTER TABLE public.accreditation_documents DROP COLUMN IF EXISTS doc_type;
ALTER TABLE public.accreditation_documents DROP COLUMN IF EXISTS file_name;
ALTER TABLE public.accreditation_documents DROP COLUMN IF EXISTS file_url;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0053', 'simplify_accreditation_documents')
ON CONFLICT (version) DO NOTHING;