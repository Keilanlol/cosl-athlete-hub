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
  sent_by uuid REFERENCES public.user_profiles(id),
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
