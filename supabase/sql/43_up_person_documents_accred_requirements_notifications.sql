-- ============================================================================
-- 43 UP. Person Documents + Accreditation Requirements + Notifications
-- ============================================================================
-- 1. Créer person_documents (FK persons) et migrer depuis athlete_documents
-- 2. Créer accreditation_requirements (par game + role + doc_type + stage)
-- 3. Ajouter role_code à accreditations, rendre accreditation_type_id nullable
-- 4. Ajouter related_person_id et related_doc_type à notifications
-- 5. Seed document_types dans app_type_items
-- 6. Migrer les données depuis accreditation_types → accreditation_requirements
-- ============================================================================

-- ── 1. Table person_documents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.person_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  category text,
  doc_type text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  issued_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'pending',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requires_action boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_docs ON public.person_documents(person_id);

-- Migration des données existantes : athlete_documents → person_documents
-- via athlete_profiles.legacy_athlete_id
INSERT INTO public.person_documents (person_id, category, doc_type, file_name, file_url, issued_date, expiry_date, status, uploaded_by, requires_action, created_at)
SELECT ap.person_id, d.category, d.doc_type, d.file_name, d.file_url, d.issued_date, d.expiry_date, d.status, d.uploaded_by, d.requires_action, d.created_at
FROM public.athlete_documents d
JOIN public.athlete_profiles ap ON ap.legacy_athlete_id = d.athlete_id
WHERE ap.person_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 2. Table accreditation_requirements ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accreditation_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  doc_type_code text NOT NULL,
  selection_stage text,
  required boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, role_code, doc_type_code, selection_stage)
);

CREATE INDEX IF NOT EXISTS idx_accred_req_game ON public.accreditation_requirements(game_id, role_code);

-- ── 3. Modifier accreditations ─────────────────────────────────────────────
ALTER TABLE public.accreditations ADD COLUMN IF NOT EXISTS role_code text;
ALTER TABLE public.accreditations ALTER COLUMN accreditation_type_id DROP NOT NULL;

-- ── 4. Modifier notifications ──────────────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_doc_type text;

-- ── 5. Seed document_types dans app_type_items ──────────────────────────────
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('document_types', 'passport',         'Passeport',                 1,  true),
  ('document_types', 'id_card',          'Carte d''identité',          2,  true),
  ('document_types', 'cns_card',         'Carte CNS / assurance',      3,  true),
  ('document_types', 'adel_certificate', 'Certificat e-learning ADEL', 4,  true),
  ('document_types', 'convention',       'Convention',                5,  true),
  ('document_types', 'olympic_contract', 'Contrat olympique',          6,  true),
  ('document_types', 'code_of_conduct',  'Code of Conduct',           7,  true),
  ('document_types', 'medical_form',     'Fiche médicale',            8,  true),
  ('document_types', 'photo_identite',   'Photo d''identité',          9,  true),
  ('document_types', 'visa',             'Visa',                      10, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 6. Migrer accreditation_types → accreditation_requirements ─────────────
-- Pour les rôles non-athlete : une colonne (selection_stage = NULL)
INSERT INTO public.accreditation_requirements (game_id, role_code, doc_type_code, selection_stage, required)
SELECT t.game_id, t.category, doc, NULL, true
FROM public.accreditation_types t, unnest(COALESCE(t.required_documents, ARRAY[]::text[])) AS doc
ON CONFLICT DO NOTHING;

-- Pour le rôle athlete : requirements par étape de sélection
INSERT INTO public.accreditation_requirements (game_id, role_code, doc_type_code, selection_stage, required)
SELECT t.game_id, 'athlete', doc, stage.status, true
FROM public.accreditation_types t
CROSS JOIN (VALUES ('pre_selected'), ('selected'), ('reserve')) AS stage(status)
, unnest(COALESCE(t.required_documents, ARRAY[]::text[])) AS doc
WHERE t.category = 'athlete'
ON CONFLICT DO NOTHING;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0043', 'person_documents_accred_requirements_notifications')
ON CONFLICT (version) DO NOTHING;