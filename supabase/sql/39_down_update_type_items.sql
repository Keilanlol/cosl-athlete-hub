-- ============================================================================
-- 39 DOWN. Rollback de la migration 39 — restaure l'état précédent
-- ============================================================================
-- À exécuter pour annuler la migration 39.
-- Restaure les valeurs à partir du snapshot (38b) et des valeurs connues.
-- ============================================================================

-- ── 1. Restaurer app_type_items depuis le snapshot ───────────────────────────
-- Supprimer les lignes ajoutées par la migration 39
DELETE FROM public.app_type_items
WHERE group_key = 'coach_roles' AND code IN ('other', 'press_v2', 'physio_v2', 'team_manager', 'judge');

DELETE FROM public.app_type_items
WHERE group_key = 'federation_member_roles' AND code = 'staff';

DELETE FROM public.app_type_items
WHERE group_key = 'accreditation_categories' AND code IN ('president', 'secretary_general');

DELETE FROM public.app_type_items
WHERE group_key = 'game_types' AND code = 'world_games';

-- Supprimer toutes les lignes actuelles et restaurer depuis le snapshot
DELETE FROM public.app_type_items;
INSERT INTO public.app_type_items
SELECT * FROM migration_39_snapshot_app_type_items;

-- ── 2. Restaurer les rôles des federation_members ───────────────────────────
UPDATE public.federation_members fm
SET role = snap.role
FROM migration_39_snapshot_federation_members_roles snap
WHERE fm.id = snap.id;

-- Restaurer aussi dans federation_member_profiles (même logique)
UPDATE public.federation_member_profiles fmp
SET role = CASE role
    WHEN 'other'    THEN COALESCE(
      (SELECT snap.role FROM migration_39_snapshot_federation_members_roles snap
       JOIN federation_members fm ON fm.id = fmp.legacy_federation_member_id
       WHERE snap.id = fm.id), role)
    WHEN 'member_ca' THEN COALESCE(
      (SELECT snap.role FROM migration_39_snapshot_federation_members_roles snap
       JOIN federation_members fm ON fm.id = fmp.legacy_federation_member_id
       WHERE snap.id = fm.id), role)
    ELSE role
END
WHERE role IN ('other', 'member_ca')
AND fmp.legacy_federation_member_id IS NOT NULL;

-- ── 3. Restaurer les statuts d'accréditation ─────────────────────────────────
UPDATE public.accreditations acc
SET status = snap.status
FROM migration_39_snapshot_accreditation_statuses snap
WHERE acc.id = snap.id;

-- ── 4. Restaurer les rôles des coaches ──────────────────────────────────────
-- Le remapping inverse : press_v2 → press (ancien code), physio_v2 → physio
UPDATE public.coaches
SET role = CASE role
    WHEN 'press_v2'  THEN 'press'
    WHEN 'physio_v2' THEN 'physio'
    ELSE role
END
WHERE role IN ('press_v2', 'physio_v2');

UPDATE public.athlete_relations
SET relation_role = CASE relation_role
    WHEN 'press_v2'  THEN 'press'
    WHEN 'physio_v2' THEN 'physio'
    ELSE relation_role
END
WHERE relation_role IN ('press_v2', 'physio_v2');

-- ── 5. Nettoyer le snapshot (optionnel — garder pour sécurité) ───────────────
-- DROP TABLE IF EXISTS migration_39_snapshot_app_type_items;
-- DROP TABLE IF EXISTS migration_39_snapshot_federation_members_roles;
-- DROP TABLE IF EXISTS migration_39_snapshot_accreditation_statuses;

-- ── 6. Retirer la migration du tracking ──────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0039';