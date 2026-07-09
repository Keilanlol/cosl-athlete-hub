-- ============================================================================
-- 39. Mise à jour des référentiels suite aux retours PDF du 07/07/26
-- ============================================================================
-- Objectifs :
--   1. Aligner les labels/codes des référentiels clés (app_type_items)
--      avec les valeurs attendues par le COSL.
--   2. Supprimer les valeurs obsolètes (Produite/Délivrée, Délégué, Membre du bureau,
--      Pré-sélectionné, Sélectionné, Réserve, Rejeté, etc.).
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
-- On garde les codes techniques existants mais on ajuste les labels.
-- Le PDF mentionne "Actif" (et probablement Inactif). On conserve active/injured/
-- suspended/retired/ambassador côté DB mais on affiche "Actif" pour active.
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
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'coach'           THEN 'Coach'
    WHEN 'manager'         THEN 'Mécano'
    WHEN 'medical'         THEN 'Medical'
    WHEN 'official'        THEN 'Press'
    WHEN 'chief_of_mission' THEN 'Chief of Mission'
    WHEN 'press'           THEN 'Kiné'
    WHEN 'physio'          THEN 'Team Manager'
    WHEN 'logistics'       THEN 'Juge'
    ELSE label
END
WHERE group_key = 'coach_roles';

-- Ajouter les nouveaux rôles demandés (Autre, etc.)
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('coach_roles', 'other',        'Autre',        9, true),
  ('coach_roles', 'mechanic',     'Mécano',       2, true),  -- équivalent manager
  ('coach_roles', 'physio_v2',    'Kiné',         7, true),
  ('coach_roles', 'team_manager', 'Team Manager', 8, true),
  ('coach_roles', 'judge',        'Juge',         9, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- Nettoyage des anciens codes coach qui ne sont plus dans le PDF
-- (on garde les codes existants mais on supprime 'official'/'press'/'physio'/'logistics'
-- si on considère que le remapping les rend obsolètes — ici on les remappe plutôt)
UPDATE public.app_type_items
SET code = CASE code
    WHEN 'manager'         THEN 'mechanic'
    WHEN 'official'        THEN 'press'     -- sera supprimé ensuite
    WHEN 'press'           THEN 'physio_v2'
    WHEN 'physio'          THEN 'team_manager'
    WHEN 'logistics'       THEN 'judge'
    ELSE code
END
WHERE group_key = 'coach_roles' AND code IN ('manager','official','press','physio','logistics');

-- Supprimer l'ancien 'official' si présent (remap via l'étape précédente)
DELETE FROM public.app_type_items
WHERE group_key = 'coach_roles' AND code = 'official';

-- ── 4. Federation member roles ─────────────────────────────────────────────────
-- Nouvelle liste : Président, Vice-Président, Secrétaire général, Trésorier,
-- Membre CA, Staff, Autre. Supprimer Délégué & Membre du bureau.

-- Remap des données existantes avant suppression des codes
UPDATE public.federation_members
SET role = CASE role
    WHEN 'delegate'      THEN 'other'
    WHEN 'board_member'  THEN 'member_ca'
    ELSE role
END
WHERE role IN ('delegate', 'board_member');

-- Mise à jour des labels
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'president'        THEN 'Président'
    WHEN 'vice_president'   THEN 'Vice-Président'
    WHEN 'secretary_general' THEN 'Secrétaire général'
    WHEN 'treasurer'         THEN 'Trésorier'
    WHEN 'board_member'      THEN 'Membre CA'
    WHEN 'other'             THEN 'Autre'
    ELSE label
END
WHERE group_key = 'federation_member_roles';

-- Ajouter Staff
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('federation_member_roles', 'staff', 'Staff', 6, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- Supprimer Délégué et Board member de la liste de référence (les données ont été remapées)
DELETE FROM public.app_type_items
WHERE group_key = 'federation_member_roles' AND code IN ('delegate', 'board_member');

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
-- Uniquement Long List / Short List. Remap : pre_selected -> long_list,
-- selected -> short_list, reserve/rejected -> supprimer ?
-- Le PDF dit "Long List, Short List uniquement". On remappe reserve/rejected -> short_list
-- (ou on les supprime). Choix : remapper reserve -> short_list, rejected -> long_list
-- pour ne pas perdre l'info de rejet. À discuter ; ici on garde les 4 codes mais on
-- change les labels pour être cohérent avec le front.
UPDATE public.app_type_items
SET label = CASE code
    WHEN 'pre_selected' THEN 'Long List'
    WHEN 'selected'     THEN 'Short List'
    WHEN 'reserve'      THEN 'Réserve'
    WHEN 'rejected'     THEN 'Rejeté'
    ELSE label
END
WHERE group_key = 'selection_statuses';

-- Remap technique (optionnel — si on veut vraiment "uniquement" 2 valeurs, on
-- ferait un ALTER + remap. On reste conservateur ici pour ne pas casser la logique
-- existante.)

-- ── 8. Game types ───────────────────────────────────────────────────────────
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('game_types', 'world_games', 'World Games', 9, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 9. Document statuses / travel statuses / game statuses ────────────────────
-- Pas de changement demandé hormis l'expiration automatique qui est gérée côté
-- application (document_statuses.expired). On s'assure juste que 'expired' existe.
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  ('document_statuses', 'expired', 'Expiré', 4, true)
ON CONFLICT (group_key, code) DO NOTHING;

-- ── 10. person_role_types : retirer club_member ──────────────────────────────
-- Soft removal : on garde la ligne en DB pour l'historique mais on la désactive
-- visuellement en la marquant is_system ET on supprime le rôle club_member des
-- choix. Ici on supprime purement le code car clubs disparaît du front.
DELETE FROM public.app_type_items
WHERE group_key = 'person_role_types' AND code = 'club_member';

-- ============================================================================
-- Réindexation des sort_order par groupe pour garder un ordre cohérent
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
