-- ============================================================================
-- 62 UP. Contrainte d'unicité sur (game_id, person_id, sport_id) pour selections
-- ============================================================================
-- La contrainte existante UNIQUE(game_id, athlete_id, discipline_id) porte sur
-- des colonnes legacy et ne protège pas les sélections créées via person_id.
-- On ajoute un index unique partiel sur (game_id, person_id, sport_id).
-- sport_id est nullable pour les encadrants (migration 45) → index partiel
-- WHERE person_id IS NOT NULL AND sport_id IS NOT NULL pour les athlètes.
-- Un second index partiel WHERE person_id IS NOT NULL AND sport_id IS NULL
-- garantit l'unicité (game_id, person_id) pour les encadrants sans sport.
-- ============================================================================
-- ⚠️ NE PAS APPLIPLIER AVANT LE NETTOYAGE DES DOUBLONS VALIDÉ PAR L'UTILISATEUR.
-- L'index unique échouerait s'il existe déjà des doublons.
-- Exécuter d'abord la requête de recensement fournie (Partie 4.1).
-- ============================================================================

BEGIN;

-- ── Index unique partiel pour les sélections avec sport (athlètes) ──────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_selections_game_person_sport_unique
  ON public.selections (game_id, person_id, sport_id)
  WHERE person_id IS NOT NULL AND sport_id IS NOT NULL;

-- ── Index unique partiel pour les sélections sans sport (encadrants) ────────
-- Un encadrant ne peut avoir qu'une seule sélection par Games
CREATE UNIQUE INDEX IF NOT EXISTS idx_selections_game_person_no_sport_unique
  ON public.selections (game_id, person_id)
  WHERE person_id IS NOT NULL AND sport_id IS NULL;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0062', 'selections_unique_game_person_sport')
ON CONFLICT (version) DO NOTHING;

COMMIT;