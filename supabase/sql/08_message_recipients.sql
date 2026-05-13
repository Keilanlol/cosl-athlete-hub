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
