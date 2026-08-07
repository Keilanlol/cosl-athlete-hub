-- ============================================================================
-- 59 UP. Tables d'alias pour transport_type et accommodation_type
-- ============================================================================
-- Complément de la migration 0058 (_and_migrate) qui a seedé les groupes
-- et migré les valeurs hors référentiel.
-- Cette migration crée les tables d'alias pour le remappage futur de
-- valeurs texte libre qui pourraient réapparaître (saisie manuelle, import).
-- ============================================================================
-- ⚠️ À exécuter APRÈS la 0058.
-- ============================================================================

-- ── 1. Table d'alias pour transport_type ─────────────────────────────────────
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

-- Appliquer le remappage sur les valeurs restantes non conformes
UPDATE public.local_transports
SET transport_type = a.new_code
FROM public.transport_type_aliases a
WHERE local_transports.transport_type = a.old_value
  AND local_transports.transport_type <> a.new_code;

-- ── 2. Table d'alias pour accommodation type ──────────────────────────────────
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

-- Appliquer le remappage sur les valeurs restantes non conformes
UPDATE public.accommodations
SET type = a.new_code
FROM public.accommodation_type_aliases a
WHERE accommodations.type = a.old_value
  AND accommodations.type <> a.new_code;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0059', 'transport_accommodation_aliases')
ON CONFLICT (version) DO NOTHING;