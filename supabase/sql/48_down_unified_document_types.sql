-- ============================================================================
-- 48 DOWN. Rollback de la migration 48
-- ============================================================================
-- Restaure l'état précédent depuis le snapshot.
-- ============================================================================

-- ── 1. Supprimer les FK vers document_type_codes ────────────────────────────
ALTER TABLE public.person_documents DROP CONSTRAINT IF EXISTS person_documents_doc_type_fkey;
ALTER TABLE public.accreditation_documents DROP CONSTRAINT IF EXISTS accreditation_documents_doc_type_fkey;
ALTER TABLE public.accreditation_requirements DROP CONSTRAINT IF EXISTS accreditation_requirements_doc_type_code_fkey;

-- ── 2. Supprimer le trigger et la fonction ──────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_document_type_codes ON public.app_type_items;
DROP FUNCTION IF EXISTS public.sync_document_type_codes();

-- ── 3. Supprimer la table de projection ─────────────────────────────────────
DROP TABLE IF EXISTS public.document_type_codes;

-- ── 4. Restaurer les anciennes valeurs de doc_type depuis le snapshot ───────
UPDATE public.person_documents pd
SET doc_type = snap.doc_type
FROM migration_48_snapshot_person_documents snap
WHERE pd.id = snap.id;

UPDATE public.accreditation_documents ad
SET doc_type = snap.doc_type
FROM migration_48_snapshot_accreditation_documents snap
WHERE ad.id = snap.id;

UPDATE public.accreditation_requirements ar
SET doc_type_code = snap.doc_type_code
FROM migration_48_snapshot_accreditation_requirements snap
WHERE ar.id = snap.id;

-- ── 5. Supprimer les colonnes ajoutées à app_type_items ─────────────────────
ALTER TABLE public.app_type_items DROP COLUMN IF EXISTS category;
ALTER TABLE public.app_type_items DROP COLUMN IF EXISTS description;
ALTER TABLE public.app_type_items DROP COLUMN IF EXISTS is_active;

-- ── 6. Supprimer les codes ajoutés par la migration 48 ──────────────────────
-- Codes nouveaux (non système) ajoutés dans app_type_items(document_types)
DELETE FROM public.app_type_items
WHERE group_key = 'document_types'
  AND code IN ('contract','medical_cert','medical_license','press_card',
               'antidoping','license','rule40','selection','ethics','insurance')
  AND is_system = false;

-- Restaurer les items depuis le snapshot (au cas où des codes existants
-- auraient été modifiés par la migration — category par exemple n'existe plus)
DELETE FROM public.app_type_items WHERE group_key = 'document_types';
INSERT INTO public.app_type_items (id, group_key, code, label, sort_order, is_system, created_at)
SELECT id, group_key, code, label, sort_order, is_system, created_at
FROM migration_48_snapshot_app_type_items
WHERE group_key = 'document_types'
ON CONFLICT (id) DO NOTHING;

-- ── 7. Supprimer la table d'alias ───────────────────────────────────────────
DROP TABLE IF EXISTS public.doc_type_aliases;

-- ── 8. Restaurer document_types (renommer document_types_deprecated) ────────
ALTER TABLE IF EXISTS public.document_types_deprecated RENAME TO document_types;

-- ── 9. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0048';

-- Note : les tables de snapshot sont conservées (par sécurité) —
-- suppression manuelle optionnelle.