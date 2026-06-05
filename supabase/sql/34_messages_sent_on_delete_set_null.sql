-- Permet la suppression d'un compte même s'il a envoyé des messages.
-- On met sent_by à NULL au lieu de bloquer.

ALTER TABLE public.messages_sent
  DROP CONSTRAINT IF EXISTS messages_sent_sent_by_fkey;

ALTER TABLE public.messages_sent
  ADD CONSTRAINT messages_sent_sent_by_fkey
  FOREIGN KEY (sent_by)
  REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;
