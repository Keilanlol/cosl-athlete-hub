-- BF-IMG-003 — Seed des images d'entités (logos + photos)
-- Idempotent : ne touche QUE les lignes qui n'ont pas encore d'image.
-- URLs publiques DiceBear (SVG) ; le storage_path reste NULL — il sera renseigné
-- automatiquement quand l'utilisateur uploadera une vraie image via l'UI.

-- Fédérations : logo « initiales » coloré
UPDATE public.federations
SET logo_url = 'https://api.dicebear.com/9.x/initials/svg?radius=20&backgroundType=gradientLinear&seed='
              || regexp_replace(coalesce(NULLIF(short_name, ''), name), '\s+', '+', 'g')
WHERE logo_url IS NULL;

-- Clubs : logo « initiales » coloré (acronyme si dispo, sinon nom)
UPDATE public.clubs
SET logo_url = 'https://api.dicebear.com/9.x/initials/svg?radius=20&backgroundType=gradientLinear&seed='
              || regexp_replace(coalesce(NULLIF(acronym, ''), name), '\s+', '+', 'g')
WHERE logo_url IS NULL;

-- Membres de fédération : avatar style « avataaars » seedé sur l'id
UPDATE public.federation_members
SET photo_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=' || id::text
WHERE photo_url IS NULL;

-- Membres de club : idem
UPDATE public.club_members
SET photo_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=' || id::text
WHERE photo_url IS NULL;

-- Encadrants : idem
UPDATE public.coaches
SET photo_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=' || id::text
WHERE photo_url IS NULL;
