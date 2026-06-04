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
