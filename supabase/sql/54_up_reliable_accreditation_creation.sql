-- ============================================================================
-- 54 UP. Fiabiliser la création des accréditations
-- ============================================================================
-- 1. Backfill person_id des 15 accréditations legacy (athlete_id sans person_id)
-- 2. Nettoyer les 3 doublons (game_id, person_id) — garder la 1ère, transférer
--    les accreditation_documents, supprimer la 2ème
-- 3. Index unique partiel sur (game_id, person_id) WHERE person_id IS NOT NULL
-- 4. accreditation_requirements : index unique partiel pour selection_stage IS NULL
-- 5. Fonction sync_accreditations_for_game(p_game_id) en RPC
-- 6. Trigger de synchronisation full_name
-- ============================================================================

-- ── Snapshot avant modification ─────────────────────────────────────────────
DROP TABLE IF EXISTS migration_54_snapshot_accreditations;
CREATE TABLE migration_54_snapshot_accreditations AS
  SELECT * FROM public.accreditations;

-- ── 1. Backfill person_id des accréditations legacy ─────────────────────────
-- Via athlete_profiles.legacy_athlete_id → person_id
UPDATE public.accreditations a
SET person_id = ap.person_id
FROM public.athlete_profiles ap
WHERE a.athlete_id = ap.legacy_athlete_id
  AND a.person_id IS NULL
  AND ap.person_id IS NOT NULL;

-- Fallback : via athletes.person_id
UPDATE public.accreditations a
SET person_id = ath.person_id
FROM public.athletes ath
WHERE a.athlete_id = ath.id
  AND a.person_id IS NULL
  AND ath.person_id IS NOT NULL;

-- Backfill role_code pour les accréditations legacy qui n'en ont pas
UPDATE public.accreditations
SET role_code = 'athlete'
WHERE role_code IS NULL
  AND athlete_id IS NOT NULL;

-- ── 2. Nettoyer les 3 doublons ──────────────────────────────────────────────
-- Pour chaque doublon, garder la ligne avec le plus petit id (ordre arbitraire
-- puisque created_at est identique), transférer les accreditation_documents,
-- puis supprimer la doublon.

-- 2a. Transférer les accreditation_documents du doublon vers la ligne gardée
UPDATE public.accreditation_documents ad
SET accreditation_id = kept.id
FROM (
  SELECT
    dup.game_id,
    dup.person_id,
    min(dup.id) AS keep_id,
    dup.id AS dup_id
  FROM public.accreditations dup
  WHERE dup.person_id IS NOT NULL
    AND dup.id NOT IN (
      SELECT (array_agg(id ORDER BY id))[1] FROM public.accreditations
      WHERE person_id IS NOT NULL
      GROUP BY game_id, person_id
      HAVING count(*) > 1
    )
    AND (dup.game_id, dup.person_id) IN (
      SELECT game_id, person_id
      FROM public.accreditations
      WHERE person_id IS NOT NULL
      GROUP BY game_id, person_id
      HAVING count(*) > 1
    )
) AS dups
JOIN public.accreditations kept
  ON kept.game_id = dups.game_id
  AND kept.person_id = dups.person_id
  AND kept.id = dups.keep_id
WHERE ad.accreditation_id = dups.dup_id;

-- 2b. Supprimer les doublons (ceux qui ne sont pas la ligne gardée)
DELETE FROM public.accreditations
WHERE id IN (
  SELECT dup.id
  FROM public.accreditations dup
  WHERE dup.person_id IS NOT NULL
    AND dup.id NOT IN (
      SELECT (array_agg(id ORDER BY id))[1] FROM public.accreditations
      WHERE person_id IS NOT NULL
      GROUP BY game_id, person_id
    )
    AND (dup.game_id, dup.person_id) IN (
      SELECT game_id, person_id
      FROM public.accreditations
      WHERE person_id IS NOT NULL
      GROUP BY game_id, person_id
      HAVING count(*) > 1
    )
);

-- ── 3. Index unique partiel ─────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_accreditations_game_person_unique
  ON public.accreditations (game_id, person_id)
  WHERE person_id IS NOT NULL;

-- ── 4. accreditation_requirements : index unique partiel pour stage NULL ────
-- La contrainte UNIQUE(game_id, role_code, doc_type_code, selection_stage)
-- ne protège pas le cas NULL (NULL <> NULL en Postgres).
-- On ajoute un index unique partiel dédié.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accred_req_null_stage_unique
  ON public.accreditation_requirements (game_id, role_code, doc_type_code)
  WHERE selection_stage IS NULL;

-- ── 5. Fonction sync_accreditations_for_game(p_game_id) ─────────────────────
-- Idempotente : INSERT ... ON CONFLICT DO NOTHING
-- Résout le rôle via role_accreditation_mapping
-- Retourne les sélections non traitées (pas de person_id résolu)

CREATE OR REPLACE FUNCTION public.sync_accreditations_for_game(p_game_id uuid)
RETURNS TABLE(
  selection_id uuid,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sel RECORD;
  v_person_id uuid;
  v_full_name text;
  v_role_code text;
  v_coach_role text;
  v_fed_role text;
  v_mapped_cat text;
BEGIN
  FOR sel IN
    SELECT s.id, s.athlete_id, s.person_id, s.status
    FROM public.selections s
    WHERE s.game_id = p_game_id
      AND s.status IN ('pre_selected', 'selected', 'reserve')
  LOOP
    v_person_id := sel.person_id;
    v_full_name := '';
    v_role_code := 'athlete';

    -- Résoudre person_id
    IF sel.athlete_id IS NOT NULL AND v_person_id IS NULL THEN
      SELECT ap.person_id INTO v_person_id
      FROM public.athlete_profiles ap
      WHERE ap.legacy_athlete_id = sel.athlete_id
      LIMIT 1;

      IF v_person_id IS NULL THEN
        SELECT ath.person_id INTO v_person_id
        FROM public.athletes ath
        WHERE ath.id = sel.athlete_id
        LIMIT 1;
      END IF;
    END IF;

    -- Si toujours pas de person_id, signaler
    IF v_person_id IS NULL THEN
      INSERT INTO public.accreditations (game_id, person_id, full_name, status, role_code)
      VALUES (p_game_id, NULL, '', 'draft', v_role_code)
      ON CONFLICT DO NOTHING;
      -- Retourner l'info pour l'UI
      -- (ne peut pas retourner depuis une boucle directement, on accumule)
      NEXT;
    END IF;

    -- Récupérer le nom
    SELECT (p.first_name || ' ' || p.last_name) INTO v_full_name
    FROM public.persons p
    WHERE p.id = v_person_id;

    -- Résoudre le rôle si ce n'est pas un athlète
    IF sel.athlete_id IS NULL AND v_person_id IS NOT NULL THEN
      -- Essayer coach_profiles (limit(1) au lieu de maybeSingle)
      SELECT cp.role INTO v_coach_role
      FROM public.coach_profiles cp
      WHERE cp.person_id = v_person_id AND cp.is_active = true
      LIMIT 1;

      IF v_coach_role IS NOT NULL THEN
        SELECT ram.accreditation_category INTO v_mapped_cat
        FROM public.role_accreditation_mapping ram
        WHERE ram.source_group = 'coach_roles' AND ram.source_code = v_coach_role;
        v_role_code := COALESCE(v_mapped_cat, 'coach');
      ELSE
        -- Essayer federation_member_profiles
        SELECT fmp.role INTO v_fed_role
        FROM public.federation_member_profiles fmp
        WHERE fmp.person_id = v_person_id AND fmp.is_active = true
        LIMIT 1;

        IF v_fed_role IS NOT NULL THEN
          SELECT ram.accreditation_category INTO v_mapped_cat
          FROM public.role_accreditation_mapping ram
          WHERE ram.source_group = 'federation_member_roles' AND ram.source_code = v_fed_role;
          v_role_code := COALESCE(v_mapped_cat, 'official');
        END IF;
      END IF;
    END IF;

    -- Insérer l'accréditation (idempotente)
    INSERT INTO public.accreditations (game_id, person_id, full_name, status, role_code)
    VALUES (p_game_id, v_person_id, v_full_name, 'draft', v_role_code)
    ON CONFLICT DO NOTHING;

    -- Réinitialiser pour la prochaine itération
    v_person_id := NULL;
    v_full_name := '';
    v_role_code := 'athlete';
    v_coach_role := NULL;
    v_fed_role := NULL;
    v_mapped_cat := NULL;
  END LOOP;

  -- Retourner les sélections sans person_id résolu
  RETURN QUERY
  SELECT s.id, 'Pas de person_id résolu'::text
  FROM public.selections s
  WHERE s.game_id = p_game_id
    AND s.status IN ('pre_selected', 'selected', 'reserve')
    AND s.person_id IS NULL
    AND s.athlete_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.athlete_profiles ap
      WHERE ap.legacy_athlete_id = s.athlete_id AND ap.person_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.athletes ath
      WHERE ath.id = s.athlete_id AND ath.person_id IS NOT NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_accreditations_for_game(uuid) TO authenticated;

-- ── 6. Trigger de synchronisation full_name ─────────────────────────────────
-- Met à jour accreditations.full_name quand persons.first_name ou
-- persons.last_name change.

CREATE OR REPLACE FUNCTION public.sync_accreditation_full_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.first_name IS DISTINCT FROM OLD.first_name OR
    NEW.last_name IS DISTINCT FROM OLD.last_name
  ) THEN
    UPDATE public.accreditations
    SET full_name = NEW.first_name || ' ' || NEW.last_name
    WHERE person_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_accreditation_full_name ON public.persons;
CREATE TRIGGER trg_sync_accreditation_full_name
  AFTER UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.sync_accreditation_full_name();

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0054', 'reliable_accreditation_creation')
ON CONFLICT (version) DO NOTHING;