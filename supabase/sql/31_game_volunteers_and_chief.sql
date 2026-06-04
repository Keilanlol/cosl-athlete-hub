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
-- Drop l'ancienne FK AVANT le backfill, sinon les UPDATE échouent contre coaches.
ALTER TABLE public.delegations
  DROP CONSTRAINT IF EXISTS delegations_chief_of_mission_id_fkey;

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
