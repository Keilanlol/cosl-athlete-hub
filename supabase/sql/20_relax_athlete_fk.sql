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
