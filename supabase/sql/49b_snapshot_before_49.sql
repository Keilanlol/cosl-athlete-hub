-- ============================================================================
-- 49b. SNAPSHOT — Sauvegarde avant la migration 49
-- ============================================================================
-- Sauvegarde les tables qui seront modifiées par la migration 49 :
--   - app_type_items (correction du libellé de logistics)
--   - accreditations (rattrapage du role_code medical → coach)
--   - coach_profiles (remappage des éventuels logistics → judge)
-- ============================================================================

DROP TABLE IF EXISTS migration_49_snapshot_app_type_items_coach_roles;
DROP TABLE IF EXISTS migration_49_snapshot_accreditations;
DROP TABLE IF EXISTS migration_49_snapshot_coach_profiles;

CREATE TABLE migration_49_snapshot_app_type_items_coach_roles AS
  SELECT * FROM public.app_type_items WHERE group_key = 'coach_roles';

CREATE TABLE migration_49_snapshot_accreditations AS
  SELECT id, role_code FROM public.accreditations;

CREATE TABLE migration_49_snapshot_coach_profiles AS
  SELECT id, role FROM public.coach_profiles;

-- Vérification
-- SELECT COUNT(*) FROM migration_49_snapshot_app_type_items_coach_roles;
-- SELECT COUNT(*) FROM migration_49_snapshot_accreditations;
-- SELECT COUNT(*) FROM migration_49_snapshot_coach_profiles;