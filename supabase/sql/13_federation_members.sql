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
