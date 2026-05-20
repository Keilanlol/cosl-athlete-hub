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
