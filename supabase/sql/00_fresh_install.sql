-- ============================================================================
-- COSLxBloobiz — Installation fraîche (schéma + référentiels + admin)
-- ----------------------------------------------------------------------------
-- À exécuter depuis le dossier supabase/sql/ avec psql :
--   psql "$DATABASE_URL" -f 00_fresh_install.sql
--
-- Contenu :
--   • Toutes les migrations structurelles (01 → 32)
--   • Données de référence (sports, fédérations, disciplines, rangs sponsors…)
--   • Aucune donnée métier (athlètes, games, clubs, messages, accreditations…)
--   • Comptes admin COSL (mot de passe par défaut : Coslbloobiz2026!)
--
-- Pré-requis : base PostgreSQL Supabase VIDE (sinon, voir bloc DROP ci-dessous
-- ou repartir d'un dump propre).
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- 1) Schéma : enums, tables, RLS, triggers, fonctions RPC
-- ----------------------------------------------------------------------------
\echo '>>> 01_init (schéma de base)'
\i 01_init.sql

\echo '>>> 02_storage (buckets photos)'
\i 02_storage.sql

\echo '>>> 04_palmares (résultats sportifs)'
\i 04_palmares.sql

\echo '>>> 05_game_sport_disciplines'
\i 05_game_sport_disciplines.sql

\echo '>>> 06_reference_data (sports + fédérations + disciplines)'
\i 06_reference_data.sql

\echo '>>> 07_athlete_appointments'
\i 07_athlete_appointments.sql

\echo '>>> 08_message_recipients'
\i 08_message_recipients.sql

\echo '>>> 10_documents_bucket'
\i 10_documents_bucket.sql

\echo '>>> 11_local_transport_passengers'
\i 11_local_transport_passengers.sql

\echo '>>> 12_rooming_allow_empty'
\i 12_rooming_allow_empty.sql

\echo '>>> 13_federation_members'
\i 13_federation_members.sql

\echo '>>> 14_club_members'
\i 14_club_members.sql

\echo '>>> 15_kyc_extended'
\i 15_kyc_extended.sql

\echo '>>> 16_age_competition'
\i 16_age_competition.sql

\echo '>>> 17_athlete_photo'
\i 17_athlete_photo.sql

\echo '>>> 18_clubs_address_fields'
\i 18_clubs_address_fields.sql

\echo '>>> 19_extended_address_fields'
\i 19_extended_address_fields.sql

\echo '>>> 20_relax_athlete_fk'
\i 20_relax_athlete_fk.sql

\echo '>>> 21_entity_images'
\i 21_entity_images.sql

\echo '>>> 22_club_members_photo'
\i 22_club_members_photo.sql

\echo '>>> 24_clubs_federation_nullable'
\i 24_clubs_federation_nullable.sql

\echo '>>> 26_normalize_member_roles'
\i 26_normalize_member_roles.sql

\echo '>>> 27_reseed_reference_data (refresh référentiels)'
\i 27_reseed_reference_data.sql

\echo '>>> 28_games_logo'
\i 28_games_logo.sql

\echo '>>> 30_persons_superclass'
\i 30_persons_superclass.sql

\echo '>>> 31_game_volunteers_and_chief'
\i 31_game_volunteers_and_chief.sql

\echo '>>> 32_sponsors_partners'
\i 32_sponsors_partners.sql

-- NOTE : les migrations suivantes sont volontairement SKIPPÉES car elles
-- contiennent uniquement de la donnée métier de démo :
--   • 03_seed_auth_users.sql        → remplacé par le bloc admin ci-dessous
--   • 09_seed_messages.sql          → messages de démo
--   • 23_seed_entity_images.sql     → logos clubs/fédés de démo
--   • 25_reset_and_reseed.sql       → reset + dataset complet de démo
--   • 29_games_real_logos.sql       → logos rattachés à games seedés

-- ----------------------------------------------------------------------------
-- 2) Paramétrage applicatif par défaut (rangs sponsors)
-- ----------------------------------------------------------------------------
\echo '>>> Sponsor ranks par défaut'
INSERT INTO public.sponsor_ranks (name, sort_order) VALUES
  ('Platinum', 10),
  ('Gold',     20),
  ('Silver',   30),
  ('Bronze',   40)
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) Comptes admin COSL (auth.users + identités + user_profiles)
-- ----------------------------------------------------------------------------
-- Mot de passe par défaut : Coslbloobiz2026!  (à changer après première
-- connexion). Ajoute/retire des lignes dans le VALUES selon les comptes
-- voulus. Si un user existe déjà (même email), il est ignoré.
-- ----------------------------------------------------------------------------
\echo '>>> Création des comptes admin COSL'
DO $$
DECLARE
  r record;
  v_user_id uuid;
  v_password text := 'Coslbloobiz2026!';
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('felix.retter',   'Felix Retter',   'admin'),
    ('laurent.carnol', 'Laurent Carnol', 'games_manager'),
    ('sophie.weber',   'Sophie Weber',   'fed_manager'),
    ('marc.dupont',    'Marc Dupont',    'logistics'),
    ('claire.muller',  'Claire Muller',  'communication')
  ) AS t(username, full_name, role)
  LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = r.username || '@coslbloobiz.local') THEN
      RAISE NOTICE 'User % déjà existant, skip', r.username;
      CONTINUE;
    END IF;

    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      r.username || '@coslbloobiz.local',
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('username', r.username, 'full_name', r.full_name, 'role', r.role),
      now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', r.username || '@coslbloobiz.local', 'email_verified', true),
      'email',
      v_user_id::text,
      now(), now(), now()
    );

    INSERT INTO public.user_profiles (id, username, full_name, email, role)
    VALUES (v_user_id, r.username, r.full_name, r.username || '@coslbloobiz.local', r.role::public.user_role)
    ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          username = EXCLUDED.username;

    RAISE NOTICE 'Créé : % (%)', r.username, r.role;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4) Vérifications finales
-- ----------------------------------------------------------------------------
\echo ''
\echo '=== Comptes créés ==='
SELECT u.email, p.username, p.role
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE u.email LIKE '%@coslbloobiz.local'
ORDER BY p.role;

\echo ''
\echo '=== Référentiels chargés ==='
SELECT 'federations' AS table, count(*) FROM public.federations
UNION ALL SELECT 'sports',         count(*) FROM public.sports
UNION ALL SELECT 'disciplines',    count(*) FROM public.disciplines
UNION ALL SELECT 'sponsor_ranks',  count(*) FROM public.sponsor_ranks;

\echo ''
\echo '>>> Installation terminée.'
