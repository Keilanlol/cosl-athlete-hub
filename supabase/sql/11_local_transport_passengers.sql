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
