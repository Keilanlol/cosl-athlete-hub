-- ============================================================================
-- 27. Re-seed des référentiels (niveaux athlètes & types de documents)
-- ----------------------------------------------------------------------------
-- Le reset 25 a tronqué ces tables sans les re-remplir.
-- ============================================================================

INSERT INTO public.athlete_levels_ref (code, label, sort_order) VALUES
  ('elite',            'Élite',              1),
  ('promotion',        'Promotion',          2),
  ('espoir',           'Espoir',             3),
  ('olympic_contract', 'Contrat olympique',  4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.document_types (code, label, category, sort_order) VALUES
  ('passport',     'Passeport',                 'admin',       1),
  ('id_card',      'Carte d''identité',         'admin',       2),
  ('insurance',    'Assurance',                 'admin',       3),
  ('medical_cert', 'Certificat médical',        'medical',     1),
  ('antidoping',   'Formulaire antidopage',     'medical',     2),
  ('rule40',       'Règle 40',                  'medical',     3),
  ('license',      'Licence sportive',          'sportive',    1),
  ('selection',    'Notification de sélection', 'sportive',    2),
  ('contract',     'Contrat',                   'contractual', 1),
  ('ethics',       'Charte éthique',            'contractual', 2)
ON CONFLICT (code) DO NOTHING;
