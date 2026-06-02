-- Allow clubs to exist without a federation (detach instead of delete)
ALTER TABLE public.clubs
  ALTER COLUMN federation_id DROP NOT NULL;

-- Replace ON DELETE RESTRICT with ON DELETE SET NULL so removing a federation
-- detaches its clubs rather than blocking the deletion.
ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_federation_id_fkey,
  ADD  CONSTRAINT clubs_federation_id_fkey
    FOREIGN KEY (federation_id) REFERENCES public.federations(id) ON DELETE SET NULL;

-- The (name, federation_id) UNIQUE constraint still works with NULLs
-- (NULLs are considered distinct), so multiple unattached clubs may share a name.
