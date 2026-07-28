-- ============================================================================
-- 49 UP. Table de correspondance role_accreditation_mapping + corrections
-- ============================================================================
-- 1. Créer public.role_accreditation_mapping avec FK vers accreditation_categories
-- 2. Remplir le mapping pour les 3 vocabulaires sources
-- 3. Corriger le doublon judge/logistics : logistics redevient « Logistique »
-- 4. Rattraper l'accréditation role_code = 'medical' → 'coach'
-- ============================================================================

-- ── 1. Créer la table de correspondance ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_accreditation_mapping (
  source_group          text NOT NULL,
  source_code           text NOT NULL,
  accreditation_category text NOT NULL,
  PRIMARY KEY (source_group, source_code)
);

-- FK de accreditation_category vers les codes du groupe accreditation_categories
-- Postgres ne supporte pas les FK partielles, on crée une table de projection.
CREATE TABLE IF NOT EXISTS public.accreditation_category_codes (
  code text PRIMARY KEY
);

INSERT INTO public.accreditation_category_codes (code)
SELECT code FROM public.app_type_items WHERE group_key = 'accreditation_categories'
ON CONFLICT DO NOTHING;

-- Trigger pour maintenir la table de projection
CREATE OR REPLACE FUNCTION public.sync_accreditation_category_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.group_key = 'accreditation_categories' THEN
    INSERT INTO public.accreditation_category_codes (code) VALUES (NEW.code) ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.group_key = 'accreditation_categories' THEN
    INSERT INTO public.accreditation_category_codes (code) VALUES (NEW.code) ON CONFLICT DO NOTHING;
    IF OLD.group_key = 'accreditation_categories' AND OLD.code <> NEW.code THEN
      DELETE FROM public.accreditation_category_codes
      WHERE code = OLD.code
        AND NOT EXISTS (
          SELECT 1 FROM public.app_type_items
          WHERE group_key = 'accreditation_categories' AND code = OLD.code
        );
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.group_key = 'accreditation_categories' THEN
    DELETE FROM public.accreditation_category_codes
    WHERE code = OLD.code
      AND NOT EXISTS (
        SELECT 1 FROM public.app_type_items
        WHERE group_key = 'accreditation_categories' AND code = OLD.code
      );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_accreditation_category_codes ON public.app_type_items;
CREATE TRIGGER trg_sync_accreditation_category_codes
  AFTER INSERT OR UPDATE OR DELETE ON public.app_type_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_accreditation_category_codes();

-- FK de role_accreditation_mapping.accreditation_category
ALTER TABLE public.role_accreditation_mapping
  ADD CONSTRAINT role_accreditation_mapping_category_fkey
  FOREIGN KEY (accreditation_category) REFERENCES public.accreditation_category_codes(code) ON DELETE RESTRICT;

-- ── 2. Remplir le mapping (validé métier) ───────────────────────────────────
INSERT INTO public.role_accreditation_mapping (source_group, source_code, accreditation_category) VALUES
  -- person_role_types
  ('person_role_types', 'athlete',          'athlete'),
  ('person_role_types', 'coach',            'coach'),
  ('person_role_types', 'federation_member','official'),
  ('person_role_types', 'official',         'official'),
  ('person_role_types', 'volunteer',        'official'),
  ('person_role_types', 'staff',            'official'),

  -- coach_roles
  ('coach_roles', 'coach',            'coach'),
  ('coach_roles', 'manager',          'coach'),
  ('coach_roles', 'medical',          'coach'),
  ('coach_roles', 'physio_v2',        'coach'),
  ('coach_roles', 'team_manager',     'coach'),
  ('coach_roles', 'chief_of_mission', 'official'),
  ('coach_roles', 'press_v2',         'press'),
  ('coach_roles', 'judge',            'vip'),
  ('coach_roles', 'logistics',        'official'),
  ('coach_roles', 'other',            'coach'),

  -- federation_member_roles
  ('federation_member_roles', 'president',         'president'),
  ('federation_member_roles', 'vice_president',    'official'),
  ('federation_member_roles', 'secretary_general', 'secretary_general'),
  ('federation_member_roles', 'treasurer',         'official'),
  ('federation_member_roles', 'member_ca',         'official'),
  ('federation_member_roles', 'staff',             'official'),
  ('federation_member_roles', 'other',             'official')
ON CONFLICT (source_group, source_code) DO NOTHING;

-- ── 3. Corriger le doublon judge/logistics dans coach_roles ─────────────────
-- logistics portait le libellé « Juge » (erreur de la migration 39).
-- On le corrige en « Logistique ».
UPDATE public.app_type_items
SET label = 'Logistique'
WHERE group_key = 'coach_roles' AND code = 'logistics' AND label = 'Juge';

-- ── 4. Rattraper l'accréditation role_code = 'medical' ──────────────────────
-- Cette personne est un encadrant médical (coach_role = 'medical'),
-- mais son accréditation pointe vers la catégorie 'medical' = « Dignitaires ».
-- On la remappe vers 'coach' (la catégorie d'accréditation correcte pour un encadrant).
UPDATE public.accreditations
SET role_code = 'coach'
WHERE role_code = 'medical';

-- ── Vérification : l'accréditation medical doit avoir disparu ────────────────
-- SELECT role_code, count(*) FROM public.accreditations GROUP BY role_code;
-- Résultat attendu : athlete = 23, coach = 1, plus aucun medical.

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0049', 'role_accreditation_mapping')
ON CONFLICT (version) DO NOTHING;