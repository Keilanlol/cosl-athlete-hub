-- ============================================================================
-- 58 UP. Groupes manquants + migration des valeurs hors référentiel
-- ============================================================================
-- 1. Créer les groupes notification_types, room_types, genders, medal_types,
--    travel_scopes dans app_type_items
-- 2. Migrer les valeurs hors référentiel :
--    - game_competitions.round (anciens libellés français → codes)
--    - local_transports.transport_type (texte libre → codes)
--    - accommodations.type (texte libre → codes)
--    - rooming_assignments.room_type (texte libre → codes)
-- ============================================================================
-- ⚠️ Cette migration et la 0059 (_and_aliases) sont complémentaires.
--    La 0058 seede les groupes et migre les valeurs.
--    La 0059 crée les tables d'alias et applique le remappage.
--    Les deux doivent être exécutées dans l'ordre : 0058 puis 0059.
-- ============================================================================

-- ── 1. Créer les groupes manquants ──────────────────────────────────────────
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  -- notification_types
  ('notification_types', 'selection_documents_required', 'Documents de sélection requis', 1, true),
  ('notification_types', 'document_action_required',     'Document à examiner',           2, true),
  ('notification_types', 'accreditation_status_change',  'Changement de statut accréditation', 3, true),
  ('notification_types', 'kyc_status_change',            'Changement de statut KYC',     4, true),
  ('notification_types', 'general',                      'Information générale',          5, true),

  -- room_types
  ('room_types', 'single',      'Single',      1, true),
  ('room_types', 'double',      'Double',      2, true),
  ('room_types', 'twin',        'Twin',        3, true),
  ('room_types', 'triple',      'Triple',      4, true),
  ('room_types', 'suite',       'Suite',       5, true),
  ('room_types', 'autre',       'Autre',       6, true),

  -- genders
  ('genders', 'male',   'Masculin', 1, true),
  ('genders', 'female', 'Féminin',  2, true),
  ('genders', 'mixed',  'Mixte',    3, true),

  -- medal_types
  ('medal_types', 'gold',   'Or',     1, true),
  ('medal_types', 'silver', 'Argent', 2, true),
  ('medal_types', 'bronze', 'Bronze', 3, true),

  -- travel_scopes
  ('travel_scopes', 'global',     'Global',     1, true),
  ('travel_scopes', 'sport',      'Sport',      2, true),
  ('travel_scopes', 'individual', 'Individuel', 3, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 2. Migrer game_competitions.round (anciens libellés → codes) ────────────
UPDATE public.game_competitions
SET round = CASE round
    WHEN 'Finale' THEN 'finale'
    WHEN 'Demi-finale' THEN 'demi_finale'
    WHEN 'Petite Finale' THEN 'petite_finale'
    WHEN 'Quart de finale' THEN 'quart_finale'
    WHEN 'Huitième de finale' THEN 'huitieme_finale'
    WHEN 'Qualification' THEN 'qualification'
    WHEN 'Séries' THEN 'series'
    WHEN 'Poules' THEN 'poules'
    ELSE round
END
WHERE round IS NOT NULL
  AND round NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'competition_rounds'
  );

-- ── 3. Migrer local_transports.transport_type (texte libre → codes) ─────────
UPDATE public.local_transports
SET transport_type = CASE
    WHEN lower(transport_type) IN ('navette', 'navettes') THEN 'navette'
    WHEN lower(transport_type) IN ('bus') THEN 'bus'
    WHEN lower(transport_type) IN ('train', 'tgv') THEN 'train'
    WHEN lower(transport_type) IN ('taxi', 'taxis') THEN 'taxi'
    WHEN lower(transport_type) IN ('voiture', 'car', 'cars') THEN 'voiture'
    WHEN lower(transport_type) IN ('minibus', 'mini-bus', 'mini bus') THEN 'minibus'
    ELSE 'autre'
END
WHERE transport_type IS NOT NULL
  AND transport_type NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'transport_types'
  );

-- ── 4. Migrer accommodations.type (texte libre → codes) ─────────────────────
UPDATE public.accommodations
SET type = CASE
    WHEN lower(type) IN ('hotel', 'hôtel', 'hotels', 'hôtels') THEN 'hotel'
    WHEN lower(type) IN ('residence', 'résidence', 'residences', 'résidences') THEN 'residence'
    WHEN lower(type) IN ('auberge', 'auberges') THEN 'auberge'
    WHEN lower(type) IN ('village', 'villages') THEN 'village'
    WHEN lower(type) IN ('appartement', 'appartements') THEN 'appartement'
    ELSE 'autre'
END
WHERE type IS NOT NULL
  AND type NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'accommodation_types'
  );

-- ── 5. Migrer rooming_assignments.room_type (texte libre → codes) ───────────
UPDATE public.rooming_assignments
SET room_type = CASE
    WHEN lower(room_type) IN ('single', 'simple') THEN 'single'
    WHEN lower(room_type) IN ('double', 'doubles') THEN 'double'
    WHEN lower(room_type) IN ('twin', 'twins') THEN 'twin'
    WHEN lower(room_type) IN ('triple', 'triples') THEN 'triple'
    WHEN lower(room_type) IN ('suite', 'suites') THEN 'suite'
    ELSE 'autre'
END
WHERE room_type IS NOT NULL
  AND room_type NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'room_types'
  );

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0058', 'seed_missing_groups_and_migrate_values')
ON CONFLICT (version) DO NOTHING;