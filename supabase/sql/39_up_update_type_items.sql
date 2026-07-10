-- ============================================================================
-- 39. Mise à jour des référentiels suite aux retours PDF du 07/07/26
-- ============================================================================
-- Objectifs :
--   1. Aligner les labels/codes des référentiels clés (app_type_items)
--      avec les valeurs attendues par le COSL.
--   2. Supprimer les valeurs obsolètes (Produite/Délivrée, Délégué, etc.).
--   3. Remapper les données existantes avant suppression.
--   4. Ajouter « World Games » et les nouveaux rôles.
-- ============================================================================

-- ── 1. Athlete levels ────────────────────────────────────────────────────────
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'elite'            THEN 'Élite'
    WHEN 'promotion'        THEN 'Promotion'
    WHEN 'espoir'           THEN 'Non cadres'
    WHEN 'olympic_contract' THEN 'SSEA'
    ELSE label
END
WHERE group_key = 'athlete_levels';

-- ── 2. Athlete statuses ─────────────────────────────────────────────────────
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'active'     THEN 'Actif'
    WHEN 'injured'    THEN 'Blessé'
    WHEN 'suspended'  THEN 'Suspendu'
    WHEN 'retired'    THEN 'Retraité'
    WHEN 'ambassador' THEN 'Ambassadeur'
    ELSE label
END
WHERE group_key = 'athlete_statuses';

-- ── 3. Coach roles ───────────────────────────────────────────────────────────
-- Nouvelle liste : Coach, Mécano, Medical, Press, Chief of Mission, Kiné,
-- Team Manager, Juge, Autre
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'coach'            THEN 'Coach'
    WHEN 'manager'          THEN 'Mécano'
    WHEN 'medical'          THEN 'Medical'
    WHEN 'chief_of_mission' THEN 'Chief of Mission'
    WHEN 'logistics'        THEN 'Juge'
    ELSE label
END
WHERE group_key = 'coach_roles';

-- Ajouter les nouveaux rôles
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('coach_roles', 'other',        'Autre',        10, true),
  ('coach_roles', 'press_v2',     'Press',         6, true),
  ('coach_roles', 'physio_v2',    'Kiné',          7, true),
  ('coach_roles', 'team_manager', 'Team Manager',   8, true),
  ('coach_roles', 'judge',        'Juge',          9, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- Supprimer les anciens codes coach obsolètes (official, press, physio)
-- après avoir remappé les données existantes
UPDATE public.coaches
SET role = CASE role
    WHEN 'official' THEN 'press_v2'
    WHEN 'press'    THEN 'press_v2'
    WHEN 'physio'   THEN 'physio_v2'
    ELSE role
END
WHERE role IN ('official', 'press', 'physio');

UPDATE public.athlete_relations
SET relation_role = CASE relation_role
    WHEN 'official' THEN 'press_v2'
    WHEN 'press'    THEN 'press_v2'
    WHEN 'physio'   THEN 'physio_v2'
    ELSE relation_role
END
WHERE relation_role IN ('official', 'press', 'physio');

DELETE FROM public.app_type_items
WHERE group_key = 'coach_roles' AND code IN ('official', 'press', 'physio');

-- ── 4. Federation member roles ─────────────────────────────────────────────────
-- Nouvelle liste : Président, Vice-Président, Secrétaire général, Trésorier,
-- Membre CA, Staff, Autre. Supprimer Délégué & Membre du bureau.

-- Remap des données existantes avant suppression
UPDATE public.federation_members
SET role = CASE role
    WHEN 'delegate'      THEN 'other'
    WHEN 'board_member'  THEN 'member_ca'
    ELSE role
END
WHERE role IN ('delegate', 'board_member');

UPDATE public.federation_member_profiles
SET role = CASE role
    WHEN 'delegate'      THEN 'other'
    WHEN 'board_member'  THEN 'member_ca'
    ELSE role
END
WHERE role IN ('delegate', 'board_member');

-- Mise à jour des labels
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'president'         THEN 'Président'
    WHEN 'vice_president'    THEN 'Vice-Président'
    WHEN 'secretary_general' THEN 'Secrétaire général'
    WHEN 'treasurer'         THEN 'Trésorier'
    WHEN 'other'             THEN 'Autre'
    ELSE label
END
WHERE group_key = 'federation_member_roles' AND code IN ('president','vice_president','secretary_general','treasurer','other');

-- Renommer board_member → member_ca dans app_type_items
UPDATE public.app_type_items
SET code = 'member_ca', label = 'Membre CA'
WHERE group_key = 'federation_member_roles' AND code = 'board_member';

-- Ajouter Staff
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('federation_member_roles', 'staff', 'Staff', 6, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- Supprimer Délégué (les données ont été remapées)
DELETE FROM public.app_type_items
WHERE group_key = 'federation_member_roles' AND code = 'delegate';

-- ── 5. Accreditation categories ─────────────────────────────────────────────
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'athlete'  THEN 'Athlete'
    WHEN 'coach'    THEN 'Encadrant'
    WHEN 'official' THEN 'NOC Guest'
    WHEN 'medical'  THEN 'Dignitaires'
    WHEN 'press'    THEN 'Press'
    WHEN 'vip'       THEN 'Juge'
    ELSE label
END
WHERE group_key = 'accreditation_categories';

-- Ajouter President, Secretary General
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('accreditation_categories', 'president',         'President',         7, true),
  ('accreditation_categories', 'secretary_general', 'Secretary General', 8, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 6. Accreditation statuses ─────────────────────────────────────────────────
-- Supprimer Produite et Délivrée. Remapper les données existantes vers Validée.
UPDATE public.accreditations
SET status = 'validated'
WHERE status IN ('produced', 'delivered');

DELETE FROM public.app_type_items
WHERE group_key = 'accreditation_statuses' AND code IN ('produced', 'delivered');

-- ── 7. Selection statuses ───────────────────────────────────────────────────
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'pre_selected' THEN 'Long List'
    WHEN 'selected'     THEN 'Short List'
    WHEN 'reserve'      THEN 'Réserve'
    WHEN 'rejected'     THEN 'Refusé'
    ELSE label
END
WHERE group_key = 'selection_statuses';

-- ── 8. Game types ───────────────────────────────────────────────────────────
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('game_types', 'world_games', 'World Games', 9, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 9. Document statuses — s'assurer que 'expired' existe ────────────────────
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('document_statuses', 'expired', 'Expiré', 4, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 10. person_role_types : retirer club_member ──────────────────────────────
DELETE FROM public.app_type_items
WHERE group_key = 'person_role_types' AND code = 'club_member';

-- ============================================================================
-- Réindexation des sort_order par groupe
-- ============================================================================
DO $$
DECLARE
    g RECORD;
BEGIN
    FOR g IN SELECT DISTINCT group_key FROM public.app_type_items LOOP
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, code) AS rn
            FROM public.app_type_items
            WHERE group_key = g.group_key
        )
        UPDATE public.app_type_items a
        SET sort_order = o.rn
        FROM ordered o
        WHERE a.id = o.id;
    END LOOP;
END $$;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0039', 'update_type_items')
ON CONFLICT (version) DO NOTHING;