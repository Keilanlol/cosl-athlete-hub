-- Permettre de créer une chambre sans occupant (placeholder row)
ALTER TABLE public.rooming_assignments
  DROP CONSTRAINT IF EXISTS rooming_assignments_check1;

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.rooming_assignments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%athlete_id%coach_id%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.rooming_assignments DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.rooming_assignments
  ADD CONSTRAINT rooming_assignments_occupant_check CHECK (
    NOT (athlete_id IS NOT NULL AND coach_id IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';
