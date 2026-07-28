-- ============================================================================
-- 49 DOWN. Rollback de la migration 49
-- ============================================================================

-- ── 1. Restaurer l'accréditation medical ────────────────────────────────────
UPDATE public.accreditations
SET role_code = 'medical'
WHERE id = (
  SELECT id FROM migration_49_snapshot_accreditations WHERE role_code = 'medical'
);

-- ── 2. Restaurer le libellé de logistics ─────────────────────────────────────
UPDATE public.app_type_items
SET label = snap.label
FROM migration_49_snapshot_app_type_items_coach_roles snap
WHERE app_type_items.group_key = 'coach_roles'
  AND app_type_items.code = 'logistics'
  AND snap.code = 'logistics';

-- ── 3. Supprimer le trigger et la fonction ──────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_accreditation_category_codes ON public.app_type_items;
DROP FUNCTION IF EXISTS public.sync_accreditation_category_codes();

-- ── 4. Supprimer les tables créées ──────────────────────────────────────────
DROP TABLE IF EXISTS public.role_accreditation_mapping;
DROP TABLE IF EXISTS public.accreditation_category_codes;

-- ── 5. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0049';

-- Note : les tables de snapshot sont conservées (par sécurité).