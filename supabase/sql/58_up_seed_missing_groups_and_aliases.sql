-- ============================================================================
-- 58 UP. Groupes manquants + alias transport + migration rounds
-- ============================================================================
-- 1. Créer les groupes room_types, notification_types, genders, medal_types,
--    travel_scopes dans app_type_items
-- 2. Alias pour les valeurs texte libre de transport_type et accommodation type
-- 3. Migrer les 2 valeurs de game_competitions.round hors référentiel
-- ============================================================================

-- ── 1. Créer les groupes manquants ──────────────────────────────────────────
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  -- room_types
  ('room_types', 'single',     'Single',     1, true),
  ('room_types', 'double',     'Double',     2, true),
  ('room_types', 'twin',       'Twin',       3, true),
  ('room_types', 'triple',     'Triple',     4, true),
  ('room_types', 'suite',      'Suite',      5, true),
  ('room_types', 'autre',      'Autre',      6, true),

  -- notification_types
  ('notification_types', 'document_action_required',  'Document à examiner',   1, true),
  ('notification_types', 'selection_documents_required', 'Documents de sélection requis', 2, true),
  ('notification_types', 'accreditation_status_change',  'Changement de statut d\'accréditation', 3, true),
  ('notification_types', 'kyc_status_change',          'Changement de statut KYC', 4, true),
  ('notification_types', 'general',                   'Notification générale',  5, true),

  -- genders (dette Phase G — maintenant dans app_type_items)
  ('genders', 'male',   'Masculin', 1, true),
  ('genders', 'female', 'Féminin',  2, true),
  ('genders', 'mixed',  'Mixte',    3, true),

  -- medal_types
  ('medal_types', 'gold',   'Or',      1, true),
  ('medal_types', 'silver', 'Argent',  2, true),
  ('medal_types', 'bronze', 'Bronze',  3, true),

  -- travel_scopes
  ('travel_scopes', 'global',     'Global',     1, true),
  ('travel_scopes', 'sport',      'Sport',      2, true),
  ('travel_scopes', 'individual', 'Individuel', 3, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 2. Migration des 2 valeurs de game_competitions.round hors référentiel ──
-- Les anciennes valeurs sont des libellés français (antérieurs à la migration 46).
-- On les remappe vers les codes correspondants.
UPDATE public.game_competitions
SET round = CASE round
  WHEN 'Finale' THEN 'finale'
  WHEN 'Demi-finale' THEN 'demi_finale'
  WHEN 'Quart de finale' THEN 'quart_finale'
  WHEN 'Huitième de finale' THEN 'huitieme_finale'
  WHEN 'Petite Finale' THEN 'petite_finale'
  WHEN 'Qualification' THEN 'qualification'
  WHEN 'Séries' THEN 'series'
  WHEN 'Poules' THEN 'poules'
  ELSE round
END
WHERE round IS NOT NULL
  AND round NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'competition_rounds'
  );

-- ── 3. Table d'alias pour transport_type (texte libre → code) ───────────────
CREATE TABLE IF NOT EXISTS public.transport_type_aliases (
  old_value text PRIMARY KEY,
  new_code text NOT NULL
);

INSERT INTO public.transport_type_aliases (old_value, new_code) VALUES
  ('navette', 'navette'),
  ('Navette', 'navette'),
  ('bus', 'bus'),
  ('Bus', 'bus'),
  ('BUS', 'bus'),
  ('train', 'train'),
  ('Train', 'train'),
  ('taxi', 'taxi'),
  ('Taxi', 'taxi'),
  ('voiture', 'voiture'),
  ('Voiture', 'voiture'),
  ('minibus', 'minibus'),
  ('Minibus', 'minibus')
ON CONFLICT (old_value) DO NOTHING;

-- Appliquer le remappage sur local_transports.transport_type
UPDATE public.local_transports
SET transport_type = a.new_code
FROM public.transport_type_aliases a
WHERE local_transports.transport_type = a.old_value
  AND local_transports.transport_type <> a.new_code;

-- ── 4. Table d'alias pour accommodation type (texte libre → code) ───────────
CREATE TABLE IF NOT EXISTS public.accommodation_type_aliases (
  old_value text PRIMARY KEY,
  new_code text NOT NULL
);

INSERT INTO public.accommodation_type_aliases (old_value, new_code) VALUES
  ('hotel', 'hotel'),
  ('Hôtel', 'hotel'),
  ('hôtel', 'hotel'),
  ('residence', 'residence'),
  ('Résidence', 'residence'),
  ('résidence', 'residence'),
  ('auberge', 'auberge'),
  ('Auberge', 'auberge'),
  ('village', 'village'),
  ('Village', 'village'),
  ('appartement', 'appartement'),
  ('Appartement', 'appartement')
ON CONFLICT (old_value) DO NOTHING;

-- Appliquer le remappage sur accommodations.type
UPDATE public.accommodations
SET type = a.new_code
FROM public.accommodation_type_aliases a
WHERE accommodations.type = a.old_value
  AND accommodations.type <> a.new_code;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0058', 'seed_missing_groups_and_aliases')
ON CONFLICT (version) DO NOTHING;