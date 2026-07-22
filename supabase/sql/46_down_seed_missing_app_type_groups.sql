-- ============================================================================
-- 46 DOWN. Rollback de la migration 46
-- ============================================================================

DELETE FROM public.app_type_items
WHERE group_key IN ('competition_rounds', 'transport_types', 'accommodation_types');

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0046';