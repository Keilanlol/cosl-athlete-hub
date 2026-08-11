-- ============================================================================
-- 62 UP. Contrainte d'unicité sur selections : (game_id, person_id, sport_id, discipline_id)
-- ============================================================================
-- La contrainte existante UNIQUE(game_id, athlete_id, discipline_id) porte sur
-- des colonnes legacy et ne protège pas les sélections créées via person_id.
--
-- On crée 3 index uniques partiels pour couvrir toutes les combinaisons
-- de nullité de sport_id et discipline_id (NULL <> NULL en Postgres) :
--
--   1. sport + discipline     → (game_id, person_id, sport_id, discipline_id)
--   2. sport sans discipline  → (game_id, person_id, sport_id)
--   3. sans sport (encadrant) → (game_id, person_id)
--
-- Aucun nettoyage préalable nécessaire : les 4 cas multi-disciplines existants
-- ont des discipline_id différents et ne violent aucune de ces contraintes.
-- ============================================================================

BEGIN;

-- ── 1. Athlète avec sport ET discipline (ex: 100m en athlétisme) ────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_selections_unique_sport_disc
  ON public.selections (game_id, person_id, sport_id, discipline_id)
  WHERE person_id IS NOT NULL AND sport_id IS NOT NULL AND discipline_id IS NOT NULL;

-- ── 2. Athlète avec sport SANS discipline (sélection au niveau sport) ───────
CREATE UNIQUE INDEX IF NOT EXISTS idx_selections_unique_sport_nodisc
  ON public.selections (game_id, person_id, sport_id)
  WHERE person_id IS NOT NULL AND sport_id IS NOT NULL AND discipline_id IS NULL;

-- ── 3. Encadrant sans sport (sport_id IS NULL depuis migration 45) ──────────
-- Un encadrant ne peut avoir qu'une seule sélection par Games
CREATE UNIQUE INDEX IF NOT EXISTS idx_selections_unique_nosport
  ON public.selections (game_id, person_id)
  WHERE person_id IS NOT NULL AND sport_id IS NULL;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0062', 'selections_unique_game_person_sport_discipline')
ON CONFLICT (version) DO NOTHING;

COMMIT;