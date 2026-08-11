-- ============================================================================
-- 64 UP. RLS sur user_profiles + RPC username→email + audit policies ALL/true
-- ============================================================================
-- CORRIGE LA FAILLE CRITIQUE : user_profiles était en ALL/true, permettant à
-- n'importe quel utilisateur authentifié de s'auto-promouvoir admin.
--
-- 1. Créer get_current_user_role() (la 56 la redéfinira à l'identique)
-- 2. Trigger BEFORE UPDATE pour geler les colonnes sensibles (role, username,
--    email, id) — seul full_name reste modifiable par un non-admin
-- 3. Policies restrictives sur user_profiles (SELECT/UPDATE/INSERT/DELETE)
-- 4. RPC resolve_username_email en SECURITY DEFINER (remplace la vue)
-- 5. Recensement des autres tables encore en ALL/true (à traiter ultérieurement)
-- ============================================================================
-- ⚠️ Cette migration doit être appliquée AVANT la 56, 57 et 60 dans l'ordre
--    d'exécution. Numérotée 64 mais à exécuter en premier.
-- ============================================================================

BEGIN;

-- ── 1. Créer get_current_user_role() ────────────────────────────────────────
-- Cette fonction est également créée par la migration 56, mais la 64 doit
-- pouvoir s'exécuter avant la 56. CREATE OR REPLACE garantit que la 56
-- redéfinira la même fonction sans erreur.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text FROM public.user_profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- ── 2. Trigger BEFORE UPDATE : geler les colonnes sensibles ─────────────────
-- Un non-admin ne peut pas modifier role, username, email, ni id.
-- Seul full_name reste modifiable. Un admin peut tout modifier.
-- Le trigger s'exécute BEFORE UPDATE, indépendamment du contexte RLS.

CREATE OR REPLACE FUNCTION public.protect_user_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role text;
BEGIN
  v_caller_role := public.get_current_user_role();

  -- Admin : tout est permis, ne pas intervenir
  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admin : geler les colonnes sensibles
  NEW.id       := OLD.id;
  NEW.role     := OLD.role;
  NEW.username := OLD.username;
  NEW.email    := OLD.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_profile_columns ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profile_columns
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_columns();

-- ── 3. Policies sur user_profiles ───────────────────────────────────────────

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

-- UPDATE : un utilisateur peut modifier sa propre ligne (le trigger gèle les
-- colonnes sensibles). Un admin peut modifier toutes les lignes.
CREATE POLICY user_profiles_update_self ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR public.get_current_user_role() = 'admin'
  )
  WITH CHECK (
    id = auth.uid()
    OR public.get_current_user_role() = 'admin'
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

-- ── 4. RPC resolve_username_email (remplace la vue) ─────────────────────────
-- Résolution username → email pour la connexion par nom d'utilisateur.
-- SECURITY DEFINER pour bypasser RLS sur user_profiles.
-- Ne renvoie qu'une seule ligne (le couple username/email), jamais la table
-- entière. Accessible à anon (le login se fait avant l'authentification).

CREATE OR REPLACE FUNCTION public.resolve_username_email(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM public.user_profiles WHERE username = p_username LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_username_email(text) TO authenticated, anon;

-- ── 5. Enregistrer la migration ─────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0064', 'user_profiles_rls_trigger_rpc')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- 6. RECENSEMENT des tables encore en ALL/true (à exécuter par l'utilisateur)
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