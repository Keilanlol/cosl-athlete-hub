-- ============================================================================
-- 38b. SNAPSHOT — Sauvegarde de l'état actuel avant la migration 39
-- ============================================================================
-- Sauvegarde les tables qui seront modifiées par la migration 39.
-- Permet de restaurer les valeurs exactes en cas de rollback.
-- ============================================================================

-- Drop anciennes tables de snapshot si elles existent (re-exécutable)
DROP TABLE IF EXISTS migration_39_snapshot_app_type_items;
DROP TABLE IF EXISTS migration_39_snapshot_federation_members_roles;
DROP TABLE IF EXISTS migration_39_snapshot_accreditation_statuses;

-- 1. Snapshot complet de app_type_items
CREATE TABLE migration_39_snapshot_app_type_items AS
  SELECT * FROM public.app_type_items;

-- 2. Snapshot des rôles des federation_members (pour remapping inverse)
CREATE TABLE migration_39_snapshot_federation_members_roles AS
  SELECT id, role FROM public.federation_members
  WHERE role IN ('delegate', 'board_member');

-- 3. Snapshot des statuts d'accréditation (pour remapping inverse)
CREATE TABLE migration_39_snapshot_accreditation_statuses AS
  SELECT id, status FROM public.accreditations
  WHERE status IN ('produced', 'delivered');

-- Vérification
-- SELECT COUNT(*) FROM migration_39_snapshot_app_type_items;
-- SELECT COUNT(*) FROM migration_39_snapshot_federation_members_roles;
-- SELECT COUNT(*) FROM migration_39_snapshot_accreditation_statuses;