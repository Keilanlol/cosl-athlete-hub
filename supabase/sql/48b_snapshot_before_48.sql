-- ============================================================================
-- 48b. SNAPSHOT — Sauvegarde avant la migration 48
-- ============================================================================
-- Sauvegarde les tables qui seront modifiées par la migration 48 :
--   - app_type_items (ajout de colonnes + insertion de nouveaux codes)
--   - person_documents (remappage de doc_type)
--   - accreditation_documents (remappage de doc_type)
--   - accreditation_requirements (remappage de doc_type_code)
--   - document_types (sera renommée en document_types_deprecated)
-- ============================================================================

DROP TABLE IF EXISTS migration_48_snapshot_app_type_items;
DROP TABLE IF EXISTS migration_48_snapshot_person_documents;
DROP TABLE IF EXISTS migration_48_snapshot_accreditation_documents;
DROP TABLE IF EXISTS migration_48_snapshot_accreditation_requirements;
DROP TABLE IF EXISTS migration_48_snapshot_document_types;

CREATE TABLE migration_48_snapshot_app_type_items AS
  SELECT * FROM public.app_type_items;

CREATE TABLE migration_48_snapshot_person_documents AS
  SELECT id, person_id, doc_type FROM public.person_documents;

CREATE TABLE migration_48_snapshot_accreditation_documents AS
  SELECT id, accreditation_id, doc_type FROM public.accreditation_documents;

CREATE TABLE migration_48_snapshot_accreditation_requirements AS
  SELECT id, game_id, role_code, doc_type_code, selection_stage FROM public.accreditation_requirements;

CREATE TABLE migration_48_snapshot_document_types AS
  SELECT * FROM public.document_types;

-- Vérification
-- SELECT COUNT(*) FROM migration_48_snapshot_app_type_items;
-- SELECT COUNT(*) FROM migration_48_snapshot_person_documents;
-- SELECT COUNT(*) FROM migration_48_snapshot_accreditation_documents;
-- SELECT COUNT(*) FROM migration_48_snapshot_accreditation_requirements;
-- SELECT COUNT(*) FROM migration_48_snapshot_document_types;