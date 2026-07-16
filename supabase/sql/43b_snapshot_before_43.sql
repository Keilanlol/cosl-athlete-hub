-- ============================================================================
-- 43b. SNAPSHOT — Sauvegarde de l'état actuel avant la migration 43
-- ============================================================================
-- Sauvegarde les tables qui seront modifiées par la migration 43.
-- Permet de restaurer les valeurs exactes en cas de rollback.
-- ============================================================================

-- Drop anciennes tables de snapshot si elles existent (re-exécutable)
DROP TABLE IF EXISTS migration_43_snapshot_athlete_documents;
DROP TABLE IF EXISTS migration_43_snapshot_accreditations;
DROP TABLE IF EXISTS migration_43_snapshot_accreditation_types;
DROP TABLE IF EXISTS migration_43_snapshot_notifications;
DROP TABLE IF EXISTS migration_43_snapshot_app_type_items_doc_types;

-- 1. Snapshot complet de athlete_documents
CREATE TABLE migration_43_snapshot_athlete_documents AS
  SELECT * FROM public.athlete_documents;

-- 2. Snapshot des colonnes de accreditations qui seront modifiées
CREATE TABLE migration_43_snapshot_accreditations AS
  SELECT id, accreditation_type_id FROM public.accreditations;

-- 3. Snapshot de accreditation_types (pour restauration des requirements)
CREATE TABLE migration_43_snapshot_accreditation_types AS
  SELECT * FROM public.accreditation_types;

-- 4. Snapshot des colonnes de notifications qui seront modifiées
CREATE TABLE migration_43_snapshot_notifications AS
  SELECT id FROM public.notifications;

-- 5. Snapshot des app_type_items du groupe document_types (pour nettoyage)
CREATE TABLE migration_43_snapshot_app_type_items_doc_types AS
  SELECT * FROM public.app_type_items WHERE group_key = 'document_types';

-- Vérification
-- SELECT COUNT(*) FROM migration_43_snapshot_athlete_documents;
-- SELECT COUNT(*) FROM migration_43_snapshot_accreditations;
-- SELECT COUNT(*) FROM migration_43_snapshot_accreditation_types;
-- SELECT COUNT(*) FROM migration_43_snapshot_notifications;