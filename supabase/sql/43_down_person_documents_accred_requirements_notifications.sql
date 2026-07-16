-- ============================================================================
-- 43 DOWN. Rollback de la migration 43
-- ============================================================================

-- ── Supprimer accreditation_requirements ────────────────────────────────────
DROP TABLE IF EXISTS public.accreditation_requirements;

-- ── Supprimer person_documents ─────────────────────────────────────────────
DROP TABLE IF EXISTS public.person_documents;

-- ── Restaurer accreditations ────────────────────────────────────────────────
-- Remettre accreditation_type_id à NOT NULL si possible (peut échouer si des
-- lignes ont un type_id NULL — on restaure d'abord les valeurs depuis le snapshot)
UPDATE public.accreditations a
SET accreditation_type_id = s.accreditation_type_id
FROM migration_43_snapshot_accreditations s
WHERE a.id = s.id;

ALTER TABLE public.accreditations DROP COLUMN IF EXISTS role_code;
-- Note: on ne remet pas NOT NULL car cela peut échouer si des lignes sont NULL
-- ALTER TABLE public.accreditations ALTER COLUMN accreditation_type_id SET NOT NULL;

-- ── Restaurer notifications ────────────────────────────────────────────────
ALTER TABLE public.notifications DROP COLUMN IF EXISTS related_person_id;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS related_doc_type;

-- ── Nettoyer document_types dans app_type_items ─────────────────────────────
-- Supprimer uniquement les items que la migration 43 a insérés
DELETE FROM public.app_type_items
WHERE group_key = 'document_types'
  AND code IN ('passport','id_card','cns_card','adel_certificate','convention',
               'olympic_contract','code_of_conduct','medical_form',
               'photo_identite','visa');

-- Restaurer les items du snapshot (ceux qui existaient avant 43)
INSERT INTO public.app_type_items (id, group_key, code, label, sort_order, is_system, created_at)
SELECT id, group_key, code, label, sort_order, is_system, created_at
FROM migration_43_snapshot_app_type_items_doc_types
ON CONFLICT (id) DO NOTHING;

-- ── Enregistrer le rollback ─────────────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0043';

-- Note: les tables de snapshot sont conservées (par sécurité) — suppression manuelle optionnelle.