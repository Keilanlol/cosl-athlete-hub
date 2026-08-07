-- ============================================================================
-- 58 DOWN. Rollback de la migration 58
-- ============================================================================

-- ── 1. Supprimer les groupes créés ──────────────────────────────────────────
DELETE FROM public.app_type_items
WHERE group_key IN ('notification_types', 'room_types', 'genders', 'medal_types', 'travel_scopes');

-- ── 2. Retirer la migration du tracking ─────────────────────────────────────
-- Note : les valeurs migrées (round, transport_type, type, room_type) ne
-- peuvent pas être restaurées à leur valeur d'origine car on n'a pas de
-- snapshot. Le rollback supprime uniquement les nouveaux groupes.
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0058';