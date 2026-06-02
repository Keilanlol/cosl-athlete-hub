-- BF-IMG-004 — Logos pour les Games (mêmes colonnes que federations/clubs)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT;

-- Seed initial : logo « initiales » DiceBear pour les Games sans logo
UPDATE public.games
SET logo_url = 'https://api.dicebear.com/9.x/initials/svg?radius=20&backgroundType=gradientLinear&seed='
              || regexp_replace(coalesce(NULLIF(short_name, ''), name), '\s+', '+', 'g')
WHERE logo_url IS NULL;

NOTIFY pgrst, 'reload schema';
