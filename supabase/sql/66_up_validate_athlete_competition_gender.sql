-- ============================================================================
-- 66 UP. Contrainte CHECK genre sur athlete_results + requête d'audit
-- ============================================================================
-- 1. Ajoute un trigger BEFORE INSERT/UPDATE sur athlete_results qui vérifie
--    la cohérence du genre entre l'athlète et l'épreuve (game_competitions.gender).
--    Un trigger est préféré à un CHECK car la validation croise deux tables.
-- 2. 'mixed' = tous les genres admis.
-- ============================================================================

BEGIN;

-- ── Snapshot avant modification ─────────────────────────────────────────────
DROP TABLE IF EXISTS migration_backups.migration_66_snapshot_athlete_results;
CREATE TABLE migration_backups.migration_66_snapshot_athlete_results AS
  SELECT * FROM public.athlete_results;

-- ── Fonction de validation du genre ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_athlete_competition_gender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_comp_gender text;
  v_athlete_gender text;
BEGIN
  -- Récupérer le genre de l'épreuve (si game_competition_id est renseigné)
  IF NEW.game_competition_id IS NOT NULL THEN
    SELECT gc.gender INTO v_comp_gender
    FROM public.game_competitions gc
    WHERE gc.id = NEW.game_competition_id;

    -- Récupérer le genre de l'athlète
    SELECT a.gender::text INTO v_athlete_gender
    FROM public.athletes a
    WHERE a.id = NEW.athlete_id;

    -- Vérifier la cohérence (mixed = tous admis)
    IF v_comp_gender IS NOT NULL
      AND v_comp_gender <> 'mixed'
      AND v_athlete_gender IS NOT NULL
      AND v_athlete_gender <> v_comp_gender THEN
      RAISE EXCEPTION
        'Genre incompatible : l''athlète (%) ne correspond pas au genre de l''épreuve (%)',
        v_athlete_gender, v_comp_gender;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_athlete_comp_gender ON public.athlete_results;
CREATE TRIGGER trg_validate_athlete_comp_gender
  BEFORE INSERT OR UPDATE OF athlete_id, game_competition_id ON public.athlete_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_athlete_competition_gender();

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0066', 'validate_athlete_competition_gender')
ON CONFLICT (version) DO NOTHING;

COMMIT;