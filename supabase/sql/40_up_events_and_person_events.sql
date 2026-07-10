-- ============================================================================
-- 40 UP. Tables events + person_events (liaison personne ↔ événement)
-- ============================================================================
-- Crée la table des événements sportifs (hors Games) et la table de liaison
-- permettant de rattacher des personnes à des événements.
-- ============================================================================

-- ── Table events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  start_date  date,
  end_date    date,
  location    text,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_all ON public.events;
CREATE POLICY events_all ON public.events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

-- ── Table person_events (liaison) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.person_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id  uuid        NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  event_id   uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, event_id)
);

ALTER TABLE public.person_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_events_all ON public.person_events;
CREATE POLICY person_events_all ON public.person_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_events TO authenticated;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0040', 'events_and_person_events')
ON CONFLICT (version) DO NOTHING;