BEGIN;

-- ════════════════════════════════════════════════════
-- 1. ENUM DES TYPES DE RÔLE
-- ════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_role_type') THEN
    CREATE TYPE public.person_role_type AS ENUM (
      'athlete', 'coach', 'federation_member', 'club_member',
      'official', 'volunteer', 'staff'
    );
  END IF;
END $$;

-- ════════════════════════════════════════════════════
-- 2. PERSONNE_PHYSIQUE — table mère
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.persons (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name              text         NOT NULL,
  last_name               text         NOT NULL,
  birth_date              date,
  gender                  public.gender,
  nationality             text,
  sport_nationality       text,
  email                   text,
  phone                   text,
  street                  text,
  postcode                text,
  city                    text,
  country                 text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  photo_url               text,
  photo_storage_path      text,
  notes                   text,
  is_active               boolean      NOT NULL DEFAULT true,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persons_email  ON public.persons (email)              WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persons_name   ON public.persons (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_persons_active ON public.persons (is_active);

-- ════════════════════════════════════════════════════
-- 3. RÔLES (junction — plusieurs rôles par personne)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.person_roles (
  id          uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid                    NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  role_type   public.person_role_type NOT NULL,
  is_active   boolean                 NOT NULL DEFAULT true,
  created_at  timestamptz             NOT NULL DEFAULT now(),
  UNIQUE (person_id, role_type)
);

CREATE INDEX IF NOT EXISTS idx_person_roles_person ON public.person_roles (person_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_type   ON public.person_roles (role_type);

-- ════════════════════════════════════════════════════
-- 4. PROFIL ATHLÈTE (1 : 1 avec persons)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  person_id             uuid                  PRIMARY KEY REFERENCES public.persons(id)     ON DELETE CASCADE,
  legacy_athlete_id     uuid                  REFERENCES public.athletes(id)                ON DELETE SET NULL,
  cosl_id               text                  UNIQUE,
  primary_sport_id      uuid                  REFERENCES public.sports(id)                  ON DELETE SET NULL,
  primary_federation_id uuid                  REFERENCES public.federations(id)             ON DELETE SET NULL,
  current_club_id       uuid                  REFERENCES public.clubs(id)                   ON DELETE SET NULL,
  status                public.athlete_status NOT NULL DEFAULT 'active',
  level                 text,
  size_clothing         text,
  size_shoes            text,
  size_gloves           text,
  license_number        text,
  ada_number            text,
  passport_number       text,
  passport_expiry       date,
  birth_place           text,
  created_at            timestamptz           NOT NULL DEFAULT now(),
  updated_at            timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_profiles_fed   ON public.athlete_profiles (primary_federation_id);
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_club  ON public.athlete_profiles (current_club_id);
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_sport ON public.athlete_profiles (primary_sport_id);

-- ════════════════════════════════════════════════════
-- 5. PROFIL ENCADRANT (N affectations possibles)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        uuid        NOT NULL REFERENCES public.persons(id)     ON DELETE CASCADE,
  legacy_coach_id  uuid        REFERENCES public.coaches(id)              ON DELETE SET NULL,
  role             text        NOT NULL,
  federation_id    uuid        REFERENCES public.federations(id)          ON DELETE SET NULL,
  club_id          uuid        REFERENCES public.clubs(id)                ON DELETE SET NULL,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_profiles_person ON public.coach_profiles (person_id);
CREATE INDEX IF NOT EXISTS idx_coach_profiles_fed    ON public.coach_profiles (federation_id) WHERE federation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coach_profiles_club   ON public.coach_profiles (club_id)       WHERE club_id IS NOT NULL;

-- ════════════════════════════════════════════════════
-- 6. PROFIL MEMBRE DE FÉDÉRATION (N memberships)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.federation_member_profiles (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id                   uuid        NOT NULL REFERENCES public.persons(id)            ON DELETE CASCADE,
  legacy_federation_member_id uuid        REFERENCES public.federation_members(id)          ON DELETE SET NULL,
  federation_id               uuid        NOT NULL REFERENCES public.federations(id)        ON DELETE CASCADE,
  role                        text        NOT NULL,
  start_date                  date,
  end_date                    date,
  is_active                   boolean     NOT NULL DEFAULT true,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, federation_id, role)
);

CREATE INDEX IF NOT EXISTS idx_fed_profiles_person ON public.federation_member_profiles (person_id);
CREATE INDEX IF NOT EXISTS idx_fed_profiles_fed    ON public.federation_member_profiles (federation_id);

-- ════════════════════════════════════════════════════
-- 7. PROFIL MEMBRE DE CLUB (N memberships)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.club_member_profiles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id             uuid        NOT NULL REFERENCES public.persons(id)  ON DELETE CASCADE,
  legacy_club_member_id uuid        REFERENCES public.club_members(id)      ON DELETE SET NULL,
  club_id               uuid        NOT NULL REFERENCES public.clubs(id)    ON DELETE CASCADE,
  role                  text        NOT NULL,
  start_date            date,
  end_date              date,
  is_active             boolean     NOT NULL DEFAULT true,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, club_id, role)
);

CREATE INDEX IF NOT EXISTS idx_club_profiles_person ON public.club_member_profiles (person_id);
CREATE INDEX IF NOT EXISTS idx_club_profiles_club   ON public.club_member_profiles (club_id);

-- ════════════════════════════════════════════════════
-- 8. COLONNE person_id SUR TABLES LEGACY (backward compat)
-- ════════════════════════════════════════════════════
ALTER TABLE public.athletes           ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL;
ALTER TABLE public.coaches            ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL;
ALTER TABLE public.federation_members ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL;
ALTER TABLE public.club_members       ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_athletes_person_id           ON public.athletes           (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coaches_person_id            ON public.coaches            (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_federation_members_person_id ON public.federation_members (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_members_person_id       ON public.club_members       (person_id) WHERE person_id IS NOT NULL;

-- ════════════════════════════════════════════════════
-- 9. MIGRATION DES DONNÉES EXISTANTES
-- ════════════════════════════════════════════════════

-- 9a. athletes → persons + athlete_profiles
DO $$
DECLARE
  a       record;
  new_pid uuid;
BEGIN
  FOR a IN SELECT * FROM public.athletes WHERE person_id IS NULL ORDER BY created_at LOOP
    INSERT INTO public.persons (
      first_name, last_name, birth_date, gender,
      nationality, sport_nationality, email, phone,
      street, postcode, city, country,
      emergency_contact_name, emergency_contact_phone,
      photo_url, is_active, created_at, updated_at
    ) VALUES (
      a.first_name, a.last_name, a.birth_date, a.gender,
      a.nationality, a.sport_nationality, a.email, a.phone,
      a.street, a.postcode, a.city, a.country,
      a.emergency_contact_name, a.emergency_contact_phone,
      a.photo_url, a.is_active, a.created_at, a.updated_at
    ) RETURNING id INTO new_pid;

    UPDATE public.athletes SET person_id = new_pid WHERE id = a.id;

    INSERT INTO public.athlete_profiles (
      person_id, legacy_athlete_id, cosl_id,
      primary_sport_id, primary_federation_id, current_club_id,
      status, level, size_clothing, size_shoes, size_gloves,
      license_number, ada_number, passport_number, passport_expiry, birth_place,
      created_at, updated_at
    ) VALUES (
      new_pid, a.id, a.cosl_id,
      a.primary_sport_id, a.primary_federation_id, a.current_club_id,
      a.status, a.level, a.size_clothing, a.size_shoes, a.size_gloves,
      a.license_number, a.ada_number, a.passport_number, a.passport_expiry, a.birth_place,
      a.created_at, a.updated_at
    );

    INSERT INTO public.person_roles (person_id, role_type) VALUES (new_pid, 'athlete');
  END LOOP;
END $$;

-- 9b. coaches → persons + coach_profiles (déduplication par email)
DO $$
DECLARE
  c       record;
  new_pid uuid;
  ex_pid  uuid;
BEGIN
  FOR c IN SELECT * FROM public.coaches WHERE person_id IS NULL ORDER BY created_at LOOP
    ex_pid := NULL;
    IF c.email IS NOT NULL THEN
      SELECT p.id INTO ex_pid FROM public.persons p WHERE p.email = c.email LIMIT 1;
    END IF;

    IF ex_pid IS NULL THEN
      INSERT INTO public.persons (
        first_name, last_name, email, phone, photo_url, is_active, created_at, updated_at
      ) VALUES (
        c.first_name, c.last_name, c.email, c.phone, c.photo_url, c.is_active, c.created_at, now()
      ) RETURNING id INTO new_pid;
    ELSE
      new_pid := ex_pid;
    END IF;

    UPDATE public.coaches SET person_id = new_pid WHERE id = c.id;

    INSERT INTO public.coach_profiles (person_id, legacy_coach_id, role, federation_id, club_id, is_active)
    VALUES (new_pid, c.id, c.role, c.federation_id, c.club_id, c.is_active);

    INSERT INTO public.person_roles (person_id, role_type)
    VALUES (new_pid, 'coach')
    ON CONFLICT (person_id, role_type) DO NOTHING;
  END LOOP;
END $$;

-- 9c. federation_members → persons + federation_member_profiles
DO $$
DECLARE
  fm      record;
  new_pid uuid;
  ex_pid  uuid;
BEGIN
  FOR fm IN SELECT * FROM public.federation_members WHERE person_id IS NULL ORDER BY created_at LOOP
    ex_pid := NULL;
    IF fm.email IS NOT NULL THEN
      SELECT p.id INTO ex_pid FROM public.persons p WHERE p.email = fm.email LIMIT 1;
    END IF;

    IF ex_pid IS NULL THEN
      INSERT INTO public.persons (
        first_name, last_name, email, phone,
        street, postcode, city, country,
        photo_url, is_active, created_at, updated_at
      ) VALUES (
        fm.first_name, fm.last_name, fm.email, fm.phone,
        fm.street, fm.postcode, fm.city, fm.country,
        fm.photo_url, fm.is_active, fm.created_at, now()
      ) RETURNING id INTO new_pid;
    ELSE
      new_pid := ex_pid;
    END IF;

    UPDATE public.federation_members SET person_id = new_pid WHERE id = fm.id;

    INSERT INTO public.federation_member_profiles (
      person_id, legacy_federation_member_id,
      federation_id, role, start_date, end_date, is_active, notes
    ) VALUES (
      new_pid, fm.id, fm.federation_id, fm.role, fm.start_date, fm.end_date, fm.is_active, fm.notes
    ) ON CONFLICT (person_id, federation_id, role) DO NOTHING;

    INSERT INTO public.person_roles (person_id, role_type)
    VALUES (new_pid, 'federation_member')
    ON CONFLICT (person_id, role_type) DO NOTHING;
  END LOOP;
END $$;

-- 9d. club_members → persons + club_member_profiles
DO $$
DECLARE
  cm      record;
  new_pid uuid;
  ex_pid  uuid;
BEGIN
  FOR cm IN SELECT * FROM public.club_members WHERE person_id IS NULL ORDER BY created_at LOOP
    ex_pid := NULL;
    IF cm.email IS NOT NULL THEN
      SELECT p.id INTO ex_pid FROM public.persons p WHERE p.email = cm.email LIMIT 1;
    END IF;

    IF ex_pid IS NULL THEN
      INSERT INTO public.persons (
        first_name, last_name, email, phone,
        street, postcode, city, country,
        photo_url, is_active, created_at, updated_at
      ) VALUES (
        cm.first_name, cm.last_name, cm.email, cm.phone,
        cm.street, cm.postcode, cm.city, cm.country,
        cm.photo_url, cm.is_active, cm.created_at, now()
      ) RETURNING id INTO new_pid;
    ELSE
      new_pid := ex_pid;
    END IF;

    UPDATE public.club_members SET person_id = new_pid WHERE id = cm.id;

    INSERT INTO public.club_member_profiles (
      person_id, legacy_club_member_id,
      club_id, role, start_date, end_date, is_active, notes
    ) VALUES (
      new_pid, cm.id, cm.club_id, cm.role, cm.start_date, cm.end_date, cm.is_active, cm.notes
    ) ON CONFLICT (person_id, club_id, role) DO NOTHING;

    INSERT INTO public.person_roles (person_id, role_type)
    VALUES (new_pid, 'club_member')
    ON CONFLICT (person_id, role_type) DO NOTHING;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════
-- 10. VUE DE CONFORT v_persons_with_roles
-- ════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_persons_with_roles AS
SELECT
  p.*,
  COALESCE(
    ARRAY_AGG(DISTINCT pr.role_type::text ORDER BY pr.role_type::text)
      FILTER (WHERE pr.role_type IS NOT NULL AND pr.is_active),
    ARRAY[]::text[]
  )                               AS roles,
  ap.cosl_id,
  ap.status                       AS athlete_status,
  ap.level                        AS athlete_level,
  ap.primary_sport_id,
  ap.primary_federation_id        AS athlete_federation_id,
  ap.current_club_id              AS athlete_club_id,
  ap.legacy_athlete_id
FROM public.persons p
LEFT JOIN public.person_roles     pr ON pr.person_id = p.id
LEFT JOIN public.athlete_profiles ap ON ap.person_id = p.id
GROUP BY
  p.id,
  ap.cosl_id, ap.status, ap.level,
  ap.primary_sport_id, ap.primary_federation_id,
  ap.current_club_id, ap.legacy_athlete_id;

GRANT SELECT ON public.v_persons_with_roles TO authenticated;

-- ════════════════════════════════════════════════════
-- 11. RLS + GRANTS
-- ════════════════════════════════════════════════════
ALTER TABLE public.persons                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_member_profiles       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'persons','person_roles','athlete_profiles',
    'coach_profiles','federation_member_profiles','club_member_profiles'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;
       CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t||'_all', t, t||'_all', t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.persons,
  public.person_roles,
  public.athlete_profiles,
  public.coach_profiles,
  public.federation_member_profiles,
  public.club_member_profiles
TO authenticated;

-- ════════════════════════════════════════════════════
-- 12. TRIGGERS updated_at
-- ════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS set_persons_updated_at          ON public.persons;
DROP TRIGGER IF EXISTS set_athlete_profiles_updated_at ON public.athlete_profiles;

CREATE TRIGGER set_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════
-- 13. VÉRIFICATION FINALE
-- ════════════════════════════════════════════════════
SELECT
  (SELECT COUNT(*) FROM public.persons)                                               AS total_persons,
  (SELECT COUNT(*) FROM public.person_roles WHERE role_type = 'athlete')              AS nb_athletes,
  (SELECT COUNT(*) FROM public.person_roles WHERE role_type = 'coach')                AS nb_coaches,
  (SELECT COUNT(*) FROM public.person_roles WHERE role_type = 'federation_member')    AS nb_fed_members,
  (SELECT COUNT(*) FROM public.person_roles WHERE role_type = 'club_member')          AS nb_club_members,
  (SELECT COUNT(*) FROM public.athletes         WHERE person_id IS NULL)              AS athletes_not_linked,
  (SELECT COUNT(*) FROM public.coaches          WHERE person_id IS NULL)              AS coaches_not_linked;

COMMIT;
NOTIFY pgrst, 'reload schema';
