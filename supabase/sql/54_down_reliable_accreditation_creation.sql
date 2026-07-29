-- ============================================================================
-- 54 DOWN. Rollback de la migration 54
-- ============================================================================

-- ── 1. Supprimer le trigger et la fonction ──────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_accreditation_full_name ON public.persons;
DROP FUNCTION IF EXISTS public.sync_accreditation_full_name();

-- ── 2. Supprimer la fonction RPC ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.sync_accreditations_for_game(uuid);

-- ── 3. Supprimer les index uniques ──────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_accred_req_null_stage_unique;
DROP INDEX IF EXISTS public.idx_accreditations_game_person_unique;

-- ── 4. Restaurer les doublons depuis le snapshot ────────────────────────────
-- On ne peut pas restaurer les doublons exactement (les accreditation_documents
-- ont été transférées), mais on restaure les lignes d'accréditation.
INSERT INTO public.accreditations (id, game_id, accreditation_type_id, athlete_id, coach_id, person_id, full_name, function_label, status, submitted_at, validated_at, validated_by, rejection_reason, notes, role_code, created_at)
SELECT id, game_id, accreditation_type_id, athlete_id, coach_id, person_id, full_name, function_label, status, submitted_at, validated_at, validated_by, rejection_reason, notes, role_code, created_at
FROM migration_54_snapshot_accreditations
WHERE id NOT IN (SELECT id FROM public.accreditations)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0054';

-- Note : le snapshot est conservé (par sécurité).