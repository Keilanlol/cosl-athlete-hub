-- ============================================================================
-- 45 DOWN. Rollback de la migration 45
-- ============================================================================

-- Restaurer la contrainte CHECK originale sur delegation_members
ALTER TABLE public.delegation_members DROP CONSTRAINT IF EXISTS delegation_members_entity_check;
ALTER TABLE public.delegation_members
  ADD CONSTRAINT delegation_members_athlete_or_coach_check
  CHECK (
    (athlete_id IS NOT NULL AND coach_id IS NULL) OR
    (athlete_id IS NULL AND coach_id IS NOT NULL)
  );

-- Remettre member_role NOT NULL
-- (peut échouer si des lignes ont member_role NULL — on met une valeur par défaut)
UPDATE public.delegation_members SET member_role = 'Membre' WHERE member_role IS NULL;
ALTER TABLE public.delegation_members ALTER COLUMN member_role SET NOT NULL;

-- Supprimer person_id sur delegation_members
ALTER TABLE public.delegation_members DROP COLUMN IF EXISTS person_id;

-- Remettre sport_id NOT NULL sur selections
-- (peut échouer si des lignes ont sport_id NULL — on met une valeur par défaut ou NULL)
-- On ne peut pas remettre NOT NULL sans valeur par défaut, on laisse nullable
-- ALTER TABLE public.selections ALTER COLUMN sport_id SET NOT NULL;

-- Remettre athlete_id NOT NULL sur selections
-- (peut échouer si des lignes ont athlete_id NULL — on supprime ces lignes)
DELETE FROM public.selections WHERE athlete_id IS NULL;
ALTER TABLE public.selections ALTER COLUMN athlete_id SET NOT NULL;

-- Supprimer person_id sur selections
ALTER TABLE public.selections DROP COLUMN IF EXISTS person_id;

-- ── 3. Restaurer accreditations ──────────────────────────────────────────────
ALTER TABLE public.accreditations DROP COLUMN IF EXISTS person_id;

-- Restaurer la contrainte CHECK originale
ALTER TABLE public.accreditations
  ADD CONSTRAINT accreditations_athlete_or_coach_check
  CHECK (
    (athlete_id IS NOT NULL AND coach_id IS NULL) OR
    (athlete_id IS NULL AND coach_id IS NOT NULL)
  );

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0045';