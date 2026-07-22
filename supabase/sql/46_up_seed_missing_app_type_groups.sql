-- ============================================================================
-- 46 UP. Seed des groupes manquants dans app_type_items
-- ============================================================================
-- Ajoute les groupes métier qui n'existent pas encore :
-- competition_rounds, transport_types, accommodation_types
-- ============================================================================

INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  -- Rounds de compétition
  ('competition_rounds', 'finale',           'Finale',              1, true),
  ('competition_rounds', 'petite_finale',    'Petite Finale',       2, true),
  ('competition_rounds', 'demi_finale',      'Demi-finale',         3, true),
  ('competition_rounds', 'quart_finale',     'Quart de finale',     4, true),
  ('competition_rounds', 'huitieme_finale',  'Huitième de finale',  5, true),
  ('competition_rounds', 'qualification',    'Qualification',       6, true),
  ('competition_rounds', 'series',           'Séries',              7, true),
  ('competition_rounds', 'poules',           'Poules',              8, true),
  ('competition_rounds', 'autre',            'Autre',               9, true),

  -- Types de transport local
  ('transport_types', 'navette',  'Navette',  1, true),
  ('transport_types', 'bus',      'Bus',      2, true),
  ('transport_types', 'train',    'Train',    3, true),
  ('transport_types', 'taxi',     'Taxi',     4, true),
  ('transport_types', 'voiture',  'Voiture',  5, true),
  ('transport_types', 'minibus',  'Minibus',  6, true),
  ('transport_types', 'autre',    'Autre',    7, true),

  -- Types d'hébergement
  ('accommodation_types', 'hotel',      'Hôtel',       1, true),
  ('accommodation_types', 'residence',  'Résidence',   2, true),
  ('accommodation_types', 'auberge',    'Auberge',     3, true),
  ('accommodation_types', 'village',    'Village',     4, true),
  ('accommodation_types', 'appartement','Appartement', 5, true),
  ('accommodation_types', 'autre',      'Autre',       6, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- Ajouter les métadonnées de groupe dans le frontend (APP_TYPE_GROUPS est en TS)

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0046', 'seed_missing_app_type_groups')
ON CONFLICT (version) DO NOTHING;