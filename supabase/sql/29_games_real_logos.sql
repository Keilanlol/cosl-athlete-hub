-- BF-IMG-005 — Logos officiels pour les Games seedés (sources : Wikimedia Commons)
-- Les autres Games conservent leur logo « initiales » DiceBear (ou aucun logo).

UPDATE public.games SET logo_url =
  'https://upload.wikimedia.org/wikipedia/commons/e/e8/2028_Summer_Olympics_Logo.svg'
WHERE id = '77777777-0000-0000-0000-000000000002'; -- LA 2028

UPDATE public.games SET logo_url =
  'https://upload.wikimedia.org/wikipedia/commons/2/26/French_Alps_2030.png'
WHERE id = '77777777-0000-0000-0000-000000000003'; -- Alpes 2030

UPDATE public.games SET logo_url =
  'https://upload.wikimedia.org/wikipedia/commons/2/24/Dakar_2026_Summer_Youth_Olympic_Games.svg'
WHERE id = '77777777-0000-0000-0000-000000000005'; -- JOJ Dakar 2026

-- EYOF Skopje (réutilise le logo officiel EYOF Skopje 2025, faute d'édition 2027 réelle)
UPDATE public.games SET logo_url =
  'https://skopje2025.sporteurope.org/wp-content/uploads/2023/12/Skopje2025_Logo_Color.svg'
WHERE id = '77777777-0000-0000-0000-000000000004';

-- JPEE Andorre 2027 : pas encore d'emblème officiel publié, on garde le logo
-- officiel des derniers Jeux (Andorre 2025) à titre de référence visuelle.
UPDATE public.games SET logo_url =
  'https://gsse-andorra2025.com/wp-content/uploads/2024/02/logo-gsse-andorra2025.svg'
WHERE id = '77777777-0000-0000-0000-000000000001';

NOTIFY pgrst, 'reload schema';
