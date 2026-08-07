-- ============================================================================
-- 58 DOWN. Rollback de la migration 58
-- ============================================================================

-- ── 1. Supprimer les groupes ajoutés ────────────────────────────────────────
DELETE FROM public.app_type_items
WHERE group_key IN ('room_types', 'notification_types', 'genders', 'medal_types', 'travel_scopes');

-- ── 2. Les rounds ne sont pas restaurés (les anciens libellés sont perdus)
-- Si nécessaire, restaurer depuis le snapshot (non créé car les valeurs sont
-- connues et peu nombreuses — l'utilisateur peut les corriger manuellement).

-- ── 3. Supprimer les tables d'alias ─────────────────────────────────────────
DROP TABLE IF EXISTS public.transport_type_aliases;
DROP TABLE IF EXISTS public.accommodation_type_aliases;

-- ── 4. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0058';