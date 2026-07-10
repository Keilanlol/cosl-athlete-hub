-- ============================================================================
-- 42 DOWN. Rollback de la migration 42
-- ============================================================================

ALTER TABLE public.notifications DROP COLUMN IF EXISTS related_doc_id;
ALTER TABLE public.athlete_documents DROP COLUMN IF EXISTS requires_action;
ALTER TABLE public.athlete_documents DROP COLUMN IF EXISTS uploaded_by;

DELETE FROM public.document_types
WHERE code IN ('passport','id_card','cns_card','adel_certificate','convention','olympic_contract','code_of_conduct','medical_form');

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0042';