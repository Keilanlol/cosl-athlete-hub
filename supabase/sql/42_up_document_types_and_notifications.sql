-- ============================================================================
-- 42 UP. Types de documents + notifications COSL
-- ============================================================================
-- 1. Seed les types de documents demandés (passeport, CI, CNS, ADEL,
--    Convention, Contrat olympique, Code of Conduct, Fiche médicale).
-- 2. Ajouter colonne uploaded_by sur athlete_documents (pour distinguer
--    les documents poussés par le COSL).
-- 3. La table notifications existe déjà — on ajoute juste une colonne
--    related_doc_id pour lier une notification à un document.
-- ============================================================================

-- ── 1. Types de documents ───────────────────────────────────────────────────
-- document_types table already exists; insert the new standard types
INSERT INTO public.document_types (code, label, category, sort_order)
VALUES
  ('passport',         'Passeport',              'admin',       1),
  ('id_card',          'Carte d''identité',       'admin',       2),
  ('cns_card',         'Carte CNS / assurance',   'admin',       3),
  ('adel_certificate', 'Certificat e-learning ADEL', 'admin',   4),
  ('convention',       'Convention',             'contractual', 10),
  ('olympic_contract', 'Contrat olympique',       'contractual', 11),
  ('code_of_conduct',  'Code of Conduct',         'contractual', 12),
  ('medical_form',     'Fiche médicale',          'medical',     20)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Colonne uploaded_by sur athlete_documents ────────────────────────────
ALTER TABLE public.athlete_documents
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.athlete_documents
  ADD COLUMN IF NOT EXISTS requires_action boolean DEFAULT false;

-- ── 3. Colonne related_doc_id sur notifications ─────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_doc_id uuid;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0042', 'document_types_and_notifications')
ON CONFLICT (version) DO NOTHING;