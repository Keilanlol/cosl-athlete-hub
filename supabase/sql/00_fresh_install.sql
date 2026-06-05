-- ============================================================================
-- COSLxBloobiz — Installation fraîche consolidée (SQL pur, Supabase Studio OK)
-- Schéma + référentiels + 5 comptes admin (mdp: Coslbloobiz2026!)
-- À exécuter sur une base VIDE.
-- ============================================================================


-- ============================================================================
-- >>> 01_init.sql
-- ============================================================================
-- ============================================================================
-- COSLxBloobiz — Schéma initial complet
-- Référence : CDC v3.1 COSL × Bloobiz, mai 2026
-- À appliquer sur l'instance Supabase self-hosted (ex: psql -f 01_init.sql).
-- ============================================================================

-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.user_role AS ENUM (
  'admin', 'games_manager', 'fed_manager', 'logistics', 'communication', 'reader'
);

CREATE TYPE public.athlete_status AS ENUM (
  'active', 'injured', 'suspended', 'retired', 'ambassador'
);

CREATE TYPE public.athlete_level AS ENUM (
  'elite', 'promotion', 'espoir', 'olympic_contract'
);

CREATE TYPE public.gender AS ENUM ('male', 'female', 'mixed');

CREATE TYPE public.game_type AS ENUM (
  'jo_summer', 'jo_winter', 'joj_summer', 'joj_winter',
  'jpee', 'european_games', 'eyof_summer', 'eyof_winter', 'other'
);

CREATE TYPE public.game_status AS ENUM (
  'preparation', 'in_progress', 'finished', 'archived'
);

CREATE TYPE public.selection_status AS ENUM (
  'pre_selected', 'selected', 'reserve', 'rejected'
);

CREATE TYPE public.accreditation_category AS ENUM (
  'athlete', 'coach', 'official', 'medical', 'press', 'vip'
);

CREATE TYPE public.accreditation_status AS ENUM (
  'draft', 'submitted', 'validated', 'rejected', 'produced', 'delivered'
);

CREATE TYPE public.document_status AS ENUM (
  'missing', 'pending', 'valid', 'expired', 'rejected'
);

CREATE TYPE public.document_category AS ENUM (
  'admin', 'medical', 'sportive', 'contractual'
);

CREATE TYPE public.travel_status AS ENUM (
  'planned', 'confirmed', 'modified', 'cancelled'
);

CREATE TYPE public.kyc_status AS ENUM ('green', 'orange', 'red');

-- 2. UTILISATEURS COSL
-- ============================================================================

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'reader',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. RÉFÉRENTIELS DE BASE
-- ============================================================================

CREATE TABLE public.federations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acronym text UNIQUE NOT NULL,
  name text NOT NULL,
  president_name text,
  contact_email text,
  contact_phone text,
  international_federation text,
  is_olympic boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  federation_id uuid NOT NULL REFERENCES public.federations(id) ON DELETE RESTRICT,
  city text,
  address text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, federation_id)
);

CREATE TABLE public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_olympic boolean DEFAULT true,
  is_summer boolean DEFAULT true
);

CREATE TABLE public.disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender public.gender NOT NULL DEFAULT 'mixed',
  age_category text,
  UNIQUE (sport_id, name, gender, age_category)
);

-- 4. MODULE 1 — ATHLETES
-- ============================================================================

CREATE TABLE public.athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cosl_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date NOT NULL,
  birth_place text,
  gender public.gender NOT NULL,
  nationality text NOT NULL,
  sport_nationality text,
  email text,
  phone text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_url text,
  primary_sport_id uuid REFERENCES public.sports(id),
  primary_federation_id uuid REFERENCES public.federations(id),
  current_club_id uuid REFERENCES public.clubs(id),
  status public.athlete_status NOT NULL DEFAULT 'active',
  level public.athlete_level,
  size_clothing text,
  size_shoes text,
  size_gloves text,
  license_number text,
  ada_number text,
  passport_number text,
  passport_expiry date,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_athletes_status ON public.athletes (status, is_active);
CREATE INDEX idx_athletes_federation ON public.athletes (primary_federation_id);

CREATE TABLE public.athlete_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  category public.document_category NOT NULL,
  doc_type text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  issued_date date,
  expiry_date date,
  status public.document_status NOT NULL DEFAULT 'pending',
  game_id uuid,
  uploaded_by uuid REFERENCES public.user_profiles(id),
  validated_by uuid REFERENCES public.user_profiles(id),
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_athlete_docs_athlete ON public.athlete_documents (athlete_id, status);
CREATE INDEX idx_athlete_docs_expiry ON public.athlete_documents (expiry_date) WHERE expiry_date IS NOT NULL;

CREATE TABLE public.athlete_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid UNIQUE NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  identity_verified boolean DEFAULT false,
  nationality_verified boolean DEFAULT false,
  age_eligibility_ok boolean DEFAULT false,
  antidoping_status public.kyc_status DEFAULT 'orange',
  ethics_charter_signed_at timestamptz,
  rule40_signed_at timestamptz,
  global_status public.kyc_status DEFAULT 'red',
  last_check_at timestamptz,
  notes text
);

CREATE TABLE public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL,
  federation_id uuid REFERENCES public.federations(id),
  club_id uuid REFERENCES public.clubs(id),
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.athlete_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  relation_role text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  UNIQUE (athlete_id, coach_id, relation_role)
);

-- 5. MODULE 2 — GAMES
-- ============================================================================

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  game_type public.game_type NOT NULL,
  edition_year int NOT NULL,
  host_country text,
  host_city text,
  organizer text,
  preparation_start date,
  competition_start date NOT NULL,
  competition_end date NOT NULL,
  closing_date date,
  timezone text DEFAULT 'Europe/Luxembourg',
  status public.game_status NOT NULL DEFAULT 'preparation',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (competition_start <= competition_end)
);
CREATE INDEX idx_games_status ON public.games (status);
CREATE INDEX idx_games_dates ON public.games (competition_start, competition_end);

CREATE TABLE public.game_sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id),
  is_active boolean DEFAULT true,
  UNIQUE (game_id, sport_id)
);

CREATE TABLE public.game_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id),
  discipline_id uuid REFERENCES public.disciplines(id),
  gender public.gender NOT NULL DEFAULT 'mixed',
  quota_max int NOT NULL CHECK (quota_max >= 0),
  qualification_deadline date,
  qualification_criteria text,
  notes text,
  UNIQUE (game_id, sport_id, discipline_id, gender)
);

CREATE TABLE public.selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id),
  discipline_id uuid REFERENCES public.disciplines(id),
  status public.selection_status NOT NULL DEFAULT 'pre_selected',
  selected_by uuid REFERENCES public.user_profiles(id),
  decided_at timestamptz,
  comment text,
  is_locked boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, athlete_id, discipline_id)
);
CREATE INDEX idx_selections_game ON public.selections (game_id, status);
CREATE INDEX idx_selections_athlete ON public.selections (athlete_id);

CREATE TABLE public.delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid UNIQUE NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  chief_of_mission_id uuid REFERENCES public.coaches(id),
  games_manager_id uuid REFERENCES public.user_profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.delegation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id uuid NOT NULL REFERENCES public.delegations(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
  member_role text NOT NULL,
  member_function text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (athlete_id IS NOT NULL AND coach_id IS NULL) OR
    (athlete_id IS NULL AND coach_id IS NOT NULL)
  )
);

-- 6. MODULE 3 — ACCREDITATION
-- ============================================================================

CREATE TABLE public.accreditation_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category public.accreditation_category NOT NULL,
  type_code text NOT NULL,
  description text,
  required_documents text[],
  valid_from date,
  valid_until date,
  UNIQUE (game_id, type_code)
);

CREATE TABLE public.accreditations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  accreditation_type_id uuid NOT NULL REFERENCES public.accreditation_types(id),
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  function_label text,
  status public.accreditation_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid REFERENCES public.user_profiles(id),
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (athlete_id IS NOT NULL AND coach_id IS NULL) OR
    (athlete_id IS NULL AND coach_id IS NOT NULL)
  )
);
CREATE INDEX idx_accred_game ON public.accreditations (game_id, status);

CREATE TABLE public.accreditation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accreditation_id uuid NOT NULL REFERENCES public.accreditations(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  status public.document_status NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 7. MODULE 4 — LOGISTICS
-- ============================================================================

CREATE TABLE public.travel_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  delegation_id uuid REFERENCES public.delegations(id),
  name text NOT NULL,
  scope text NOT NULL,
  sport_id uuid REFERENCES public.sports(id),
  departure_date date NOT NULL,
  return_date date NOT NULL,
  departure_point text,
  arrival_point text,
  status public.travel_status NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (departure_date <= return_date)
);

CREATE TABLE public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_plan_id uuid NOT NULL REFERENCES public.travel_plans(id) ON DELETE CASCADE,
  flight_number text NOT NULL,
  airline text,
  departure_airport text NOT NULL,
  arrival_airport text NOT NULL,
  departure_time timestamptz NOT NULL,
  arrival_time timestamptz NOT NULL,
  is_outbound boolean NOT NULL DEFAULT true,
  notes text,
  CHECK (departure_time <= arrival_time)
);

CREATE TABLE public.flight_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
  seat text,
  special_baggage text,
  notes text,
  CHECK (
    (athlete_id IS NOT NULL AND coach_id IS NULL) OR
    (athlete_id IS NULL AND coach_id IS NOT NULL)
  ),
  UNIQUE (flight_id, athlete_id, coach_id)
);

CREATE TABLE public.accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  country text,
  type text,
  total_rooms int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rooming_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid NOT NULL REFERENCES public.accommodations(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  room_type text,
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
  check_in date NOT NULL,
  check_out date NOT NULL,
  notes text,
  CHECK (check_in <= check_out),
  CHECK (
    (athlete_id IS NOT NULL AND coach_id IS NULL) OR
    (athlete_id IS NULL AND coach_id IS NOT NULL)
  )
);

CREATE TABLE public.local_transports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  transport_type text NOT NULL,
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  pickup_time timestamptz NOT NULL,
  capacity int,
  notes text
);

-- 8. MODULE 5 — COMMUNICATION
-- ============================================================================

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.message_templates(id),
  game_id uuid REFERENCES public.games(id),
  channel text NOT NULL DEFAULT 'email',
  subject text NOT NULL,
  body text NOT NULL,
  audience_segment text NOT NULL,
  recipients_count int NOT NULL DEFAULT 0,
  sent_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  message text NOT NULL,
  target_user_id uuid REFERENCES public.user_profiles(id),
  related_athlete_id uuid REFERENCES public.athletes(id),
  related_game_id uuid REFERENCES public.games(id),
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. TRIGGERS UTILITAIRES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _username text;
  _full_name text;
BEGIN
  _username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  _full_name := coalesce(new.raw_user_meta_data->>'full_name', _username);
  INSERT INTO public.user_profiles (id, username, full_name, email, role)
  VALUES (
    new.id,
    _username,
    _full_name,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'reader')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE TRIGGER set_athletes_updated_at
  BEFORE UPDATE ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. FONCTIONS RPC MÉTIER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.athlete_kyc_valid(_athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT global_status = 'green' FROM public.athlete_kyc WHERE athlete_id = _athlete_id),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.accreditation_completeness(_accreditation_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN count(*) = 0 THEN 0
      ELSE (count(*) FILTER (WHERE status = 'valid') * 100 / count(*))::int
    END
  FROM public.accreditation_documents
  WHERE accreditation_id = _accreditation_id
$$;

CREATE OR REPLACE FUNCTION public.quota_filled(
  _game_id uuid, _sport_id uuid, _discipline_id uuid, _gender public.gender
)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int
  FROM public.selections s
  JOIN public.athletes a ON a.id = s.athlete_id
  WHERE s.game_id = _game_id
    AND s.sport_id = _sport_id
    AND (s.discipline_id = _discipline_id OR _discipline_id IS NULL)
    AND a.gender = _gender
    AND s.status = 'selected'
$$;

-- 11. RLS — TOUS LES UTILISATEURS CONNECTÉS ONT ACCÈS
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accreditation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accreditations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accreditation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooming_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_transports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Policy par défaut : tout utilisateur connecté peut lire et écrire.
-- Le contrôle fin par rôle se fait côté frontend via useAuth.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_all', t
    );
  END LOOP;
END $$;


-- ============================================================================
-- >>> 02_storage.sql
-- ============================================================================
-- Storage bucket pour les documents d'accréditation
-- À appliquer après 01_init.sql sur l'instance self-hosted Supabase.

INSERT INTO storage.buckets (id, name, public)
VALUES ('accreditation-docs', 'accreditation-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "accred_docs_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'accreditation-docs');

CREATE POLICY "accred_docs_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'accreditation-docs');

CREATE POLICY "accred_docs_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'accreditation-docs');

CREATE POLICY "accred_docs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'accreditation-docs');


-- ============================================================================
-- >>> 04_palmares.sql
-- ============================================================================
-- ============================================================================
-- COSLxBloobiz — Migration 04 : Palmarès, épreuves, disciplines secondaires
-- À appliquer sur l'instance Supabase self-hosted (psql -f 04_palmares.sql).
-- ============================================================================

-- 1. Épreuves spécifiques d'un Games (BF-GAM-010 à 014)
CREATE TABLE IF NOT EXISTS public.game_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id),
  discipline_id uuid REFERENCES public.disciplines(id),
  name text NOT NULL,
  competition_date date,
  round text,
  gender text CHECK (gender IN ('male','female','mixed')),
  category text,
  venue text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_competitions_game ON public.game_competitions(game_id);

-- 2. Palmarès / résultats par athlète (Annexe B.2 hors MVP)
CREATE TABLE IF NOT EXISTS public.athlete_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id),
  game_competition_id uuid REFERENCES public.game_competitions(id),
  sport_id uuid REFERENCES public.sports(id),
  discipline_id uuid REFERENCES public.disciplines(id),
  result_date date,
  rank integer,
  medal text CHECK (medal IN ('gold','silver','bronze')),
  score text,
  unit text,
  is_national_record boolean NOT NULL DEFAULT false,
  is_personal_best boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_athlete_results_athlete ON public.athlete_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_results_game ON public.athlete_results(game_id);

-- 3. Disciplines secondaires de l'athlète (BF-ATH-013)
CREATE TABLE IF NOT EXISTS public.athlete_disciplines (
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  discipline_id uuid REFERENCES public.disciplines(id) ON DELETE CASCADE,
  PRIMARY KEY (athlete_id, discipline_id)
);

-- 4. RLS — même politique que les autres tables (tout authenticated)
ALTER TABLE public.game_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_disciplines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'game_competitions_all' AND tablename = 'game_competitions') THEN
    CREATE POLICY game_competitions_all ON public.game_competitions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'athlete_results_all' AND tablename = 'athlete_results') THEN
    CREATE POLICY athlete_results_all ON public.athlete_results
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'athlete_disciplines_all' AND tablename = 'athlete_disciplines') THEN
    CREATE POLICY athlete_disciplines_all ON public.athlete_disciplines
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_disciplines TO authenticated;


-- ============================================================================
-- >>> 05_game_sport_disciplines.sql
-- ============================================================================
-- ============================================================================
-- COSLxBloobiz — Migration 05 : Disciplines admises par sport d'un Games
-- À appliquer : psql -f 05_game_sport_disciplines.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_sport_disciplines (
  game_sport_id uuid NOT NULL REFERENCES public.game_sports(id) ON DELETE CASCADE,
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  PRIMARY KEY (game_sport_id, discipline_id)
);

CREATE INDEX IF NOT EXISTS idx_gsd_sport ON public.game_sport_disciplines(game_sport_id);

ALTER TABLE public.game_sport_disciplines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'game_sport_disciplines_all' AND tablename = 'game_sport_disciplines') THEN
    CREATE POLICY game_sport_disciplines_all ON public.game_sport_disciplines
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sport_disciplines TO authenticated;


-- ============================================================================
-- >>> 06_reference_data.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 07_athlete_appointments.sql
-- ============================================================================
-- ============================================================================
-- COSLxBloobiz — Migration 07 : Agenda / rendez-vous par athlète
-- À appliquer sur l'instance Supabase self-hosted (psql -f 07_athlete_appointments.sql).
-- Texte libre uniquement, aucun lien typé.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.athlete_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_athlete_appointments_athlete
  ON public.athlete_appointments(athlete_id, starts_at DESC);

ALTER TABLE public.athlete_appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'athlete_appointments_all'
      AND tablename = 'athlete_appointments'
  ) THEN
    CREATE POLICY athlete_appointments_all ON public.athlete_appointments
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_appointments TO authenticated;


-- ============================================================================
-- >>> 08_message_recipients.sql
-- ============================================================================
-- ============================================================================
-- COSLxBloobiz — Migration 08 : Destinataires individuels par message envoyé
-- À appliquer : psql -f 08_message_recipients.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_recipients (
  message_id uuid NOT NULL REFERENCES public.messages_sent(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_recipients_athlete
  ON public.message_recipients(athlete_id);
CREATE INDEX IF NOT EXISTS idx_msg_recipients_message
  ON public.message_recipients(message_id);

ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'message_recipients_all'
      AND tablename = 'message_recipients'
  ) THEN
    CREATE POLICY message_recipients_all ON public.message_recipients
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_recipients TO authenticated;


-- ============================================================================
-- >>> 10_documents_bucket.sql
-- ============================================================================
-- Bucket privé `documents` pour BF-ATH-040..046, BF-ACC-021, BF-LOG-060.
-- À appliquer sur l'instance self-hosted Supabase.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','application/pdf','image/webp']
) ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_upload') THEN
    CREATE POLICY "documents_authenticated_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_read') THEN
    CREATE POLICY "documents_authenticated_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_update') THEN
    CREATE POLICY "documents_authenticated_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_authenticated_delete') THEN
    CREATE POLICY "documents_authenticated_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'documents');
  END IF;
END $$;


-- ============================================================================
-- >>> 11_local_transport_passengers.sql
-- ============================================================================
-- Passagers des transports locaux (bus, navettes)
CREATE TABLE IF NOT EXISTS public.local_transport_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_transport_id uuid NOT NULL REFERENCES public.local_transports(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
  seat text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (athlete_id IS NOT NULL AND coach_id IS NULL) OR
    (athlete_id IS NULL AND coach_id IS NOT NULL)
  ),
  UNIQUE (local_transport_id, athlete_id, coach_id)
);

ALTER TABLE public.local_transport_passengers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS local_transport_passengers_all ON public.local_transport_passengers;
CREATE POLICY local_transport_passengers_all
  ON public.local_transport_passengers
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.local_transport_passengers TO authenticated;


-- ============================================================================
-- >>> 12_rooming_allow_empty.sql
-- ============================================================================
-- Permettre de créer une chambre sans occupant (placeholder row)
ALTER TABLE public.rooming_assignments
  DROP CONSTRAINT IF EXISTS rooming_assignments_check1;

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.rooming_assignments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%athlete_id%coach_id%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.rooming_assignments DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.rooming_assignments
  ADD CONSTRAINT rooming_assignments_occupant_check CHECK (
    NOT (athlete_id IS NOT NULL AND coach_id IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 13_federation_members.sql
-- ============================================================================
-- Membres de la fédération (président, trésorier, secrétaire, etc.)
CREATE TABLE IF NOT EXISTS public.federation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  federation_id uuid NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL,
  email text,
  phone text,
  address text,
  start_date date,
  end_date date,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS federation_members_federation_id_idx
  ON public.federation_members(federation_id);

ALTER TABLE public.federation_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'federation_members'
      AND policyname = 'federation_members_all'
  ) THEN
    EXECUTE 'CREATE POLICY federation_members_all ON public.federation_members FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.federation_members TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 14_club_members.sql
-- ============================================================================
-- Membres du club (président, trésorier, secrétaire, etc.)
CREATE TABLE IF NOT EXISTS public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL,
  email text,
  phone text,
  address text,
  start_date date,
  end_date date,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_members_club_id_idx
  ON public.club_members(club_id);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'club_members'
      AND policyname = 'club_members_all'
  ) THEN
    EXECUTE 'CREATE POLICY club_members_all ON public.club_members FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 15_kyc_extended.sql
-- ============================================================================
ALTER TABLE public.athlete_kyc
  ADD COLUMN IF NOT EXISTS passport_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS ci_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS sport_nationality TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_federation TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eligibility_verified_by UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS min_age_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS max_age_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS adams_number TEXT,
  ADD COLUMN IF NOT EXISTS antidoping_last_check DATE,
  ADD COLUMN IF NOT EXISTS antidoping_whereabouts_ok BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elearning_antidoping_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elearning_completed_at DATE,
  ADD COLUMN IF NOT EXISTS elearning_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS ethics_charter_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ethics_charter_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ethics_charter_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS rule40_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rule40_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rule40_doc_id UUID REFERENCES public.athlete_documents(id),
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_comment TEXT;

CREATE TABLE IF NOT EXISTS public.kyc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.user_profiles(id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  axis TEXT,
  comment TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.kyc_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public.kyc_history;
CREATE POLICY "auth_all" ON public.kyc_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.kyc_history TO authenticated, anon, service_role;


-- ============================================================================
-- >>> 16_age_competition.sql
-- ============================================================================
-- BF-ATH-052 + BF-GAM-012 — Éligibilité d'âge par épreuve
-- Ajoute min_age/max_age sur game_competitions et game_competition_id sur selections.

ALTER TABLE public.game_competitions
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS max_age INTEGER;

ALTER TABLE public.selections
  ADD COLUMN IF NOT EXISTS game_competition_id UUID
    REFERENCES public.game_competitions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.athlete_kyc.age_eligibility_ok IS 'DEPRECATED — calculé par épreuve désormais';
COMMENT ON COLUMN public.athlete_kyc.min_age_ok IS 'DEPRECATED — calculé par épreuve désormais';
COMMENT ON COLUMN public.athlete_kyc.max_age_ok IS 'DEPRECATED — calculé par épreuve désormais';


-- ============================================================================
-- >>> 17_athlete_photo.sql
-- ============================================================================
-- BF-ATH-004 — Photo officielle athlète
-- 1 seule photo d'identité par athlète, accès rapide via athletes.photo_url

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Unicité du document photo_identite par athlète
CREATE UNIQUE INDEX IF NOT EXISTS idx_athlete_photo_unique
  ON public.athlete_documents (athlete_id)
  WHERE doc_type = 'photo_identite';


-- ============================================================================
-- >>> 18_clubs_address_fields.sql
-- ============================================================================
-- 18_clubs_address_fields.sql
-- BF: Champs adresse séparés pour les clubs (street/postcode/country)
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS street   text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS country  text;


-- ============================================================================
-- >>> 19_extended_address_fields.sql
-- ============================================================================
-- 19_extended_address_fields.sql
-- BF: Champs adresse séparés (street/postcode/city/country) sur :
--   athletes, club_members, federation_members, accommodations, game_competitions
-- Tolérant si certaines tables n'existent pas encore (exécuter d'abord 13_/14_).

DO $$
BEGIN
  IF to_regclass('public.athletes') IS NOT NULL THEN
    ALTER TABLE public.athletes
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.club_members') IS NOT NULL THEN
    ALTER TABLE public.club_members
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.federation_members') IS NOT NULL THEN
    ALTER TABLE public.federation_members
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.accommodations') IS NOT NULL THEN
    ALTER TABLE public.accommodations
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;

  IF to_regclass('public.game_competitions') IS NOT NULL THEN
    ALTER TABLE public.game_competitions
      ADD COLUMN IF NOT EXISTS street   text,
      ADD COLUMN IF NOT EXISTS postcode text,
      ADD COLUMN IF NOT EXISTS city     text,
      ADD COLUMN IF NOT EXISTS country  text;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 20_relax_athlete_fk.sql
-- ============================================================================
-- Relax FK constraints so a club or federation can be deleted even if
-- (deactivated) athletes / coaches still reference it. The reference is
-- simply nulled out instead of blocking the delete.

-- Athletes
ALTER TABLE public.athletes
  DROP CONSTRAINT IF EXISTS athletes_current_club_id_fkey,
  ADD  CONSTRAINT athletes_current_club_id_fkey
    FOREIGN KEY (current_club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

ALTER TABLE public.athletes
  DROP CONSTRAINT IF EXISTS athletes_primary_federation_id_fkey,
  ADD  CONSTRAINT athletes_primary_federation_id_fkey
    FOREIGN KEY (primary_federation_id) REFERENCES public.federations(id) ON DELETE SET NULL;

ALTER TABLE public.athletes
  DROP CONSTRAINT IF EXISTS athletes_primary_sport_id_fkey,
  ADD  CONSTRAINT athletes_primary_sport_id_fkey
    FOREIGN KEY (primary_sport_id) REFERENCES public.sports(id) ON DELETE SET NULL;

-- Coaches
ALTER TABLE public.coaches
  DROP CONSTRAINT IF EXISTS coaches_federation_id_fkey,
  ADD  CONSTRAINT coaches_federation_id_fkey
    FOREIGN KEY (federation_id) REFERENCES public.federations(id) ON DELETE SET NULL;

ALTER TABLE public.coaches
  DROP CONSTRAINT IF EXISTS coaches_club_id_fkey,
  ADD  CONSTRAINT coaches_club_id_fkey
    FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 21_entity_images.sql
-- ============================================================================
-- BF-IMG-001 — Logos & photos pour entités (fédérations, clubs, membres, encadrants)
-- Stockage : URL signée 1 an dans le bucket `documents`, chemin conservé pour suppression/remplacement.

ALTER TABLE public.federations
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT;

ALTER TABLE public.federation_members
  ADD COLUMN IF NOT EXISTS photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 22_club_members_photo.sql
-- ============================================================================
-- BF-IMG-002 — Photo pour les membres de club
-- Stockage : URL signée 1 an dans le bucket `documents`.

ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 24_clubs_federation_nullable.sql
-- ============================================================================
-- Allow clubs to exist without a federation (detach instead of delete)
ALTER TABLE public.clubs
  ALTER COLUMN federation_id DROP NOT NULL;

-- Replace ON DELETE RESTRICT with ON DELETE SET NULL so removing a federation
-- detaches its clubs rather than blocking the deletion.
ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_federation_id_fkey,
  ADD  CONSTRAINT clubs_federation_id_fkey
    FOREIGN KEY (federation_id) REFERENCES public.federations(id) ON DELETE SET NULL;

-- The (name, federation_id) UNIQUE constraint still works with NULLs
-- (NULLs are considered distinct), so multiple unattached clubs may share a name.


-- ============================================================================
-- >>> 26_normalize_member_roles.sql
-- ============================================================================
-- Normalisation des rôles federation_members / club_members
-- Le seed initial avait inséré des labels FR ("Président") alors que l'UI
-- attend les valeurs canoniques ("president"). Sans ça, le président
-- n'apparaît pas dans la colonne "Président" ni dans le dashboard club.

UPDATE public.federation_members SET role = 'president'        WHERE role IN ('Président','président');
UPDATE public.federation_members SET role = 'vice_president'   WHERE role IN ('Vice-président','vice-président','Vice président');
UPDATE public.federation_members SET role = 'secretary_general' WHERE role IN ('Secrétaire général','Secrétaire générale','Secrétaire');
UPDATE public.federation_members SET role = 'treasurer'        WHERE role IN ('Trésorier','Trésorière');
UPDATE public.federation_members SET role = 'board_member'     WHERE role IN ('Membre du bureau');
UPDATE public.federation_members SET role = 'delegate'         WHERE role IN ('Délégué','Déléguée');

UPDATE public.club_members SET role = 'president'      WHERE role IN ('Président','président');
UPDATE public.club_members SET role = 'vice_president' WHERE role IN ('Vice-président','vice-président','Vice président');
UPDATE public.club_members SET role = 'secretary'      WHERE role IN ('Secrétaire');
UPDATE public.club_members SET role = 'treasurer'      WHERE role IN ('Trésorier','Trésorière');
UPDATE public.club_members SET role = 'board_member'   WHERE role IN ('Membre du bureau');
UPDATE public.club_members SET role = 'head_coach'     WHERE role IN ('Entraîneur principal','Entraineur principal');

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 27_reseed_reference_data.sql
-- ============================================================================
-- ============================================================================
-- 27. Re-seed des référentiels (niveaux athlètes & types de documents)
-- ----------------------------------------------------------------------------
-- Le reset 25 a tronqué ces tables sans les re-remplir.
-- ============================================================================

INSERT INTO public.athlete_levels_ref (code, label, sort_order) VALUES
  ('elite',            'Élite',              1),
  ('promotion',        'Promotion',          2),
  ('espoir',           'Espoir',             3),
  ('olympic_contract', 'Contrat olympique',  4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.document_types (code, label, category, sort_order) VALUES
  ('passport',     'Passeport',                 'admin',       1),
  ('id_card',      'Carte d''identité',         'admin',       2),
  ('insurance',    'Assurance',                 'admin',       3),
  ('medical_cert', 'Certificat médical',        'medical',     1),
  ('antidoping',   'Formulaire antidopage',     'medical',     2),
  ('rule40',       'Règle 40',                  'medical',     3),
  ('license',      'Licence sportive',          'sportive',    1),
  ('selection',    'Notification de sélection', 'sportive',    2),
  ('contract',     'Contrat',                   'contractual', 1),
  ('ethics',       'Charte éthique',            'contractual', 2)
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- >>> 28_games_logo.sql
-- ============================================================================
-- BF-IMG-004 — Logos pour les Games (mêmes colonnes que federations/clubs)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT;

-- Seed initial : logo « initiales » DiceBear pour les Games sans logo
UPDATE public.games
SET logo_url = 'https://api.dicebear.com/9.x/initials/svg?radius=20&backgroundType=gradientLinear&seed='
              || regexp_replace(coalesce(NULLIF(short_name, ''), name), '\s+', '+', 'g')
WHERE logo_url IS NULL;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- >>> 30_persons_superclass.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 31_game_volunteers_and_chief.sql
-- ============================================================================
-- Game volunteers junction + delegations.chief_of_mission_id repointed to persons
BEGIN;

-- 1. game_volunteers : lier une personne (avec rôle 'volunteer') à un Games.
CREATE TABLE IF NOT EXISTS public.game_volunteers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid        NOT NULL REFERENCES public.games(id)   ON DELETE CASCADE,
  person_id   uuid        NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  function    text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_game_volunteers_game   ON public.game_volunteers (game_id);
CREATE INDEX IF NOT EXISTS idx_game_volunteers_person ON public.game_volunteers (person_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_volunteers TO authenticated;
GRANT ALL ON public.game_volunteers TO service_role;

ALTER TABLE public.game_volunteers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_volunteers_all ON public.game_volunteers;
CREATE POLICY game_volunteers_all ON public.game_volunteers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. delegations.chief_of_mission_id : pointer vers persons plutôt que coaches
-- Drop dynamiquement TOUTES les FK sur delegations.chief_of_mission_id
-- (peu importe leur nom auto-généré), sinon les UPDATE échouent contre coaches.
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
      AND rel.relname = 'delegations'
      AND con.contype = 'f'
      AND con.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
          WHERE attrelid = rel.oid AND attname = 'chief_of_mission_id')
      ]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.delegations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DO $$
DECLARE
  d record;
BEGIN
  FOR d IN
    SELECT del.id AS del_id, c.person_id
    FROM public.delegations del
    JOIN public.coaches c ON c.id = del.chief_of_mission_id
    WHERE del.chief_of_mission_id IS NOT NULL
  LOOP
    UPDATE public.delegations
       SET chief_of_mission_id = d.person_id
     WHERE id = d.del_id;
  END LOOP;
END $$;

-- Nettoyer toute valeur qui ne pointe pas vers une person valide
UPDATE public.delegations d
   SET chief_of_mission_id = NULL
 WHERE chief_of_mission_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.persons p WHERE p.id = d.chief_of_mission_id);

ALTER TABLE public.delegations
  ADD CONSTRAINT delegations_chief_of_mission_id_fkey
  FOREIGN KEY (chief_of_mission_id) REFERENCES public.persons(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================================
-- >>> 32_sponsors_partners.sql
-- ============================================================================
-- Sponsors & Partenaires + liaison aux Games
-- À appliquer sur l'instance self-hosted Supabase après 31_*.

-- ===== Sponsor ranks (admin-managed) =====
CREATE TABLE IF NOT EXISTS public.sponsor_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sponsor_ranks TO authenticated;
GRANT ALL ON public.sponsor_ranks TO service_role;
ALTER TABLE public.sponsor_ranks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsor_ranks_read ON public.sponsor_ranks;
CREATE POLICY sponsor_ranks_read ON public.sponsor_ranks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sponsor_ranks_write ON public.sponsor_ranks;
CREATE POLICY sponsor_ranks_write ON public.sponsor_ranks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.sponsor_ranks (name, sort_order) VALUES
  ('Gold', 10), ('Silver', 20), ('Bronze', 30)
ON CONFLICT (name) DO NOTHING;

-- ===== Sponsors =====
CREATE TABLE IF NOT EXISTS public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  logo_url text,
  logo_storage_path text,
  rank_id uuid REFERENCES public.sponsor_ranks(id) ON DELETE SET NULL,
  contact_first_name text,
  contact_last_name text,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sponsors_rank ON public.sponsors(rank_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsors_all ON public.sponsors;
CREATE POLICY sponsors_all ON public.sponsors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Partners =====
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  logo_url text,
  logo_storage_path text,
  street text,
  postcode text,
  city text,
  country text,
  contact_first_name text,
  contact_last_name text,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partners_all ON public.partners;
CREATE POLICY partners_all ON public.partners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Game ↔ Sponsors =====
CREATE TABLE IF NOT EXISTS public.game_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, sponsor_id)
);
CREATE INDEX IF NOT EXISTS idx_game_sponsors_game ON public.game_sponsors(game_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sponsors TO authenticated;
GRANT ALL ON public.game_sponsors TO service_role;
ALTER TABLE public.game_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_sponsors_all ON public.game_sponsors;
CREATE POLICY game_sponsors_all ON public.game_sponsors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Game ↔ Partners =====
CREATE TABLE IF NOT EXISTS public.game_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_game_partners_game ON public.game_partners(game_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_partners TO authenticated;
GRANT ALL ON public.game_partners TO service_role;
ALTER TABLE public.game_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_partners_all ON public.game_partners;
CREATE POLICY game_partners_all ON public.game_partners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- >>> Sponsor ranks par défaut
-- ============================================================================
INSERT INTO public.sponsor_ranks (name, sort_order) VALUES
  ('Platinum', 10),
  ('Gold',     20),
  ('Silver',   30),
  ('Bronze',   40)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- >>> Comptes admin COSL (mot de passe par défaut : Coslbloobiz2026!)
-- ============================================================================
DO $seed_admins$
DECLARE
  r record;
  v_user_id uuid;
  v_password text := 'Coslbloobiz2026!';
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('felix.retter',   'Felix Retter',   'admin'),
    ('laurent.carnol', 'Laurent Carnol', 'games_manager'),
    ('sophie.weber',   'Sophie Weber',   'fed_manager'),
    ('marc.dupont',    'Marc Dupont',    'logistics'),
    ('claire.muller',  'Claire Muller',  'communication')
  ) AS t(username, full_name, role)
  LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = r.username || '@coslbloobiz.local') THEN
      RAISE NOTICE 'User % déjà existant, skip', r.username;
      CONTINUE;
    END IF;

    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      r.username || '@coslbloobiz.local',
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('username', r.username, 'full_name', r.full_name, 'role', r.role),
      now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', r.username || '@coslbloobiz.local', 'email_verified', true),
      'email',
      v_user_id::text,
      now(), now(), now()
    );

    INSERT INTO public.user_profiles (id, username, full_name, email, role)
    VALUES (v_user_id, r.username, r.full_name, r.username || '@coslbloobiz.local', r.role::public.user_role)
    ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          username = EXCLUDED.username;

    RAISE NOTICE 'Créé : % (%)', r.username, r.role;
  END LOOP;
END
$seed_admins$;

-- 33_admin_user_management.sql
-- RPCs sécurisées pour permettre à un admin de créer/supprimer des comptes
-- depuis l'application (sans Edge Function).
-- Le "superadmin" est identifié par username = 'admin' : il ne peut être
-- supprimé depuis l'app et n'apparaît pas dans la liste des comptes.

-- ============================================================================
-- 1. Création d'un compte (admin uniquement)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_account(
  p_username  text,
  p_full_name text,
  p_email     text,
  p_password  text,
  p_role      public.user_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_user_id     uuid;
  v_email       text;
  v_username    text;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT role INTO v_caller_role
    FROM public.user_profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  v_username := lower(trim(p_username));
  IF v_username = '' OR p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'username and full_name required';
  END IF;
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'password too short (min 8 chars)';
  END IF;

  v_email := coalesce(nullif(trim(p_email), ''), v_username || '@coslbloobiz.local');

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'email already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE username = v_username) THEN
    RAISE EXCEPTION 'username already exists';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider','email','providers',ARRAY['email']),
    jsonb_build_object('username', v_username, 'full_name', trim(p_full_name), 'role', p_role::text),
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.user_profiles (id, username, full_name, email, role)
  VALUES (v_user_id, v_username, trim(p_full_name), v_email, p_role)
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_account(text,text,text,text,public.user_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_account(text,text,text,text,public.user_role) TO authenticated;

-- ============================================================================
-- 2. Suppression d'un compte (admin uniquement, hors self & superadmin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_target_username text;
BEGIN
  SELECT role INTO v_caller_role
    FROM public.user_profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete your own account';
  END IF;

  SELECT username INTO v_target_username
    FROM public.user_profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;
  IF v_target_username = 'admin' THEN
    RAISE EXCEPTION 'cannot delete the superadmin account';
  END IF;

  -- ON DELETE CASCADE depuis auth.users → user_profiles
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_account(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid) TO authenticated;
