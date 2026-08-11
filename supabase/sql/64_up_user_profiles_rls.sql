-- ============================================================================
-- 64 UP. RLS sur user_profiles + vue username_lookup + audit policies ALL/true
-- ============================================================================
-- CORRIGE LA FAILLE CRITIQUE : user_profiles était en ALL/true, permettant à
-- n'importe quel utilisateur authentifié de s'auto-promouvoir admin.
--
-- 1. Policies restrictives sur user_profiles (SELECT/UPDATE/INSERT/DELETE)
-- 2. Vue v_username_lookup pour la connexion par username (expose uniquement
--    username + email, pas role/plain_password)
-- 3. Recensement des autres tables encore en ALL/true (à traiter ultérieurement)
-- ============================================================================
-- ⚠️ Cette migration doit être appliquée AVANT la 56, 57 et 60 dans l'ordre
--    d'exécution. Numérotée 64 mais à exécuter en premier.
-- ============================================================================

BEGIN;

-- ── 1. Policies sur user_profiles ───────────────────────────────────────────

-- Supprimer les policies existantes (permissives)
DROP POLICY IF EXISTS user_profiles_all ON public.user_profiles;
DROP POLICY IF EXISTS "username lookup public" ON public.user_profiles;

-- S'assurer que RLS est activé
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT : un utilisateur lit sa propre ligne ; un admin lit toutes les lignes
CREATE POLICY user_profiles_select_self ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_current_user_role() = 'admin'
  );

-- UPDATE : un utilisateur peut modifier ses champs non sensibles MAIS JAMAIS role.
-- Un admin peut tout modifier.
-- WITH CHECK valide la nouvelle ligne : si l'utilisateur n'est pas admin,
-- le role ne doit pas avoir changé.
CREATE POLICY user_profiles_update_self ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR public.get_current_user_role() = 'admin'
  )
  WITH CHECK (
    -- Admin : tout est permis
    public.get_current_user_role() = 'admin'
    OR (
      -- Non-admin : peut modifier sa propre ligne MAIS pas le role
      id = auth.uid()
      AND role = (
        SELECT up.role FROM public.user_profiles up WHERE up.id = auth.uid()
      )
    )
  );

-- INSERT : réservé à admin (la création de comptes passe par admin_create_account_v2
-- qui est SECURITY DEFINER et bypass RLS)
CREATE POLICY user_profiles_insert_admin ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'admin');

-- DELETE : réservé à admin (admin_delete_account est SECURITY DEFINER)
CREATE POLICY user_profiles_delete_admin ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- ── 2. Vue v_username_lookup pour la connexion par username ─────────────────
-- La fonction usernameToEmail() dans src/lib/supabase.ts fait :
--   SELECT email FROM user_profiles WHERE username = ?
-- Avant, cela fonctionnait grâce à la policy "username lookup public" (SELECT/true)
-- qui exposait TOUTE la table. On crée une vue dédiée qui n'expose que username + email.
-- La vue n'est pas protégée par RLS (les vues normales s'exécutent avec les
-- droits du propriétaire), mais elle ne contient aucune donnée sensible.

CREATE OR REPLACE VIEW public.v_username_lookup AS
  SELECT username, email FROM public.user_profiles;

GRANT SELECT ON public.v_username_lookup TO authenticated, anon;

-- ── 3. Enregistrer la migration ─────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0064', 'user_profiles_rls_username_lookup')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- 4. RECENSEMENT des tables encore en ALL/true (à exécuter par l'utilisateur)
-- ============================================================================
-- Après avoir appliqué cette migration + les migrations 56, 57, 60, exécuter :
--
--   SELECT tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND qual = 'true'
--   ORDER BY tablename, policyname;
--
-- Tables attendues encore en ALL/true (non traitées par 56/57/60/64) :
--   athletes, athlete_documents, athlete_kyc, athlete_relations,
--   coaches, games, game_sports, game_quotas, game_competitions,
--   selections, delegations, delegation_members,
--   accreditations, accreditation_documents, accreditation_types,
--   travel_plans, flights, flight_passengers, accommodations,
--   rooming_assignments, local_transports, local_transport_passengers,
--   message_templates, messages_sent, message_recipients, notifications,
--   federations, clubs, sports, disciplines,
--   persons, person_roles, athlete_profiles, coach_profiles,
--   federation_member_profiles, federation_members, club_members,
--   kyc_history, athlete_results, athlete_disciplines,
--   game_sport_disciplines, athlete_appointments,
--   game_volunteers, sponsors, partners, game_sponsors, game_partners,
--   sponsor_ranks, transport_type_aliases, accommodation_type_aliases,
--   person_events (SELECT true résiduel si 57 non appliquée)
--
-- Ces tables seront traitées dans une migration ultérieure (65+)
-- après validation des règles par rôle.