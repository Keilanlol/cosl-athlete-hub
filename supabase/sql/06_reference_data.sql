-- ============================================================================
-- 06. RÉFÉRENTIELS ÉDITABLES (niveaux athlètes & types de documents)
-- ============================================================================
-- Permet à l'admin d'ajouter/supprimer dynamiquement des valeurs depuis l'UI.
-- ============================================================================

-- 1. Niveaux d'athlètes
CREATE TABLE IF NOT EXISTS public.athlete_levels_ref (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.athlete_levels_ref (code, label, sort_order) VALUES
  ('elite', 'Élite', 1),
  ('promotion', 'Promotion', 2),
  ('espoir', 'Espoir', 3),
  ('olympic_contract', 'Contrat olympique', 4)
ON CONFLICT (code) DO NOTHING;

-- 2. Types de documents
CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.document_types (code, label, category, sort_order) VALUES
  ('passport',       'Passeport',                'admin',       1),
  ('id_card',        'Carte d''identité',        'admin',       2),
  ('insurance',      'Assurance',                'admin',       3),
  ('medical_cert',   'Certificat médical',       'medical',     1),
  ('antidoping',     'Formulaire antidopage',    'medical',     2),
  ('rule40',         'Règle 40',                 'medical',     3),
  ('license',        'Licence sportive',         'sportive',    1),
  ('selection',      'Notification de sélection','sportive',    2),
  ('contract',       'Contrat',                  'contractual', 1),
  ('ethics',         'Charte éthique',           'contractual', 2)
ON CONFLICT (code) DO NOTHING;

-- 3. Convertir athletes.level (enum) -> text pour autoriser des valeurs custom
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'athletes'
      AND column_name = 'level' AND udt_name = 'athlete_level'
  ) THEN
    ALTER TABLE public.athletes ALTER COLUMN level DROP DEFAULT;
    ALTER TABLE public.athletes ALTER COLUMN level TYPE text USING level::text;
  END IF;
END $$;

-- 4. RLS — politique permissive (le contrôle admin est géré côté frontend)
ALTER TABLE public.athlete_levels_ref ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS athlete_levels_ref_all ON public.athlete_levels_ref;
DROP POLICY IF EXISTS document_types_all     ON public.document_types;

CREATE POLICY athlete_levels_ref_all ON public.athlete_levels_ref
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY document_types_all ON public.document_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.athlete_levels_ref, public.document_types
  TO authenticated;
