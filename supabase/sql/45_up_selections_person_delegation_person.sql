-- ============================================================================
-- 45 UP. Sélections pour personnes (encadrants/membres) + Délégation auto-role
-- ============================================================================
-- 1. selections : ajouter person_id (FK persons), rendre athlete_id/sport_id nullable
--    pour permettre la sélection d'encadrants et membres de fédération
-- 2. delegation_members : ajouter person_id (FK persons), rendre athlete_id/coach_id
--    nullable + member_role nullable (déduit du profil), assouplir le CHECK
-- ============================================================================

-- ── 1. Table selections ────────────────────────────────────────────────────
ALTER TABLE public.selections ADD COLUMN IF NOT EXISTS person_id uuid
  REFERENCES public.persons(id) ON DELETE CASCADE;

-- Rendre athlete_id nullable (pour les encadrants qui ne sont pas des athlètes)
ALTER TABLE public.selections ALTER COLUMN athlete_id DROP NOT NULL;

-- Rendre sport_id nullable (pour les encadrants qui n'ont pas de sport)
ALTER TABLE public.selections ALTER COLUMN sport_id DROP NOT NULL;

-- Mettre person_id quand on a déjà athlete_id (migration des données existantes)
UPDATE public.selections s
SET person_id = ap.person_id
FROM public.athlete_profiles ap
WHERE s.athlete_id = ap.legacy_athlete_id
  AND s.person_id IS NULL
  AND ap.person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_selections_person ON public.selections (person_id);

-- ── 2. Table delegation_members ─────────────────────────────────────────────
ALTER TABLE public.delegation_members ADD COLUMN IF NOT EXISTS person_id uuid
  REFERENCES public.persons(id) ON DELETE CASCADE;

-- Rendre member_role nullable (sera déduit du profil coach/fed_member)
ALTER TABLE public.delegation_members ALTER COLUMN member_role DROP NOT NULL;

-- Supprimer l'ancienne contrainte CHECK (athlete XOR coach)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'delegation_members'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.delegation_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Nouvelle contrainte : au moins une des trois colonnes doit être non-NULL
ALTER TABLE public.delegation_members
  ADD CONSTRAINT delegation_members_entity_check
  CHECK (
    (athlete_id IS NOT NULL) OR
    (coach_id IS NOT NULL) OR
    (person_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_delegation_members_person ON public.delegation_members (person_id);

-- ── 3. Table accreditations : assouplir le CHECK + ajouter person_id ──────────
ALTER TABLE public.accreditations ADD COLUMN IF NOT EXISTS person_id uuid
  REFERENCES public.persons(id) ON DELETE CASCADE;

-- Supprimer l'ancienne contrainte CHECK (athlete XOR coach)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'accreditations'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.accreditations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Nouvelle contrainte : au moins une des trois colonnes doit être non-NULL
-- (ou aucune si on veut juste un nom — on garde permissive)
-- On ne met pas de CHECK: le code frontend garantit la cohérence

CREATE INDEX IF NOT EXISTS idx_accreditations_person ON public.accreditations (person_id);

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0045', 'selections_person_id_delegation_person_id')
ON CONFLICT (version) DO NOTHING;