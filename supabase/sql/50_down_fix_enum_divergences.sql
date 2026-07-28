-- ============================================================================
-- 50 DOWN. Rollback de la migration 50
-- ============================================================================

-- ── 1. Restaurer accreditations.status en enum ──────────────────────────────
-- Les valeurs 'produced' et 'delivered' doivent exister dans l'enum
-- (elles y sont toujours — on n'a pas pu les retirer).
ALTER TABLE public.accreditations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.accreditations ALTER COLUMN status TYPE public.accreditation_status USING status::public.accreditation_status;
ALTER TABLE public.accreditations ALTER COLUMN status SET DEFAULT 'draft'::public.accreditation_status;

-- ── 2. Retirer les valeurs ajoutées aux enums ───────────────────────────────
-- Postgres ne permet pas de retirer une valeur d'un enum.
-- Ces valeurs restent donc dans l'enum après rollback, mais elles ne sont
-- plus dans app_type_items. C'est un défaut cosmétique sans impact fonctionnel.
-- (Si nécessaire, on peut recréer l'enum sans ces valeurs, mais cela
-- nécessite de dropper et recréer toutes les colonnes qui l'utilisent.)

-- ── 3. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0050';