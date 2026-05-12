-- ============================================================================
-- Création des 5 comptes COSL dans auth.users
-- À exécuter dans Supabase Studio > SQL Editor
-- Mot de passe par défaut : Coslbloobiz2026!  (à changer ensuite)
-- ============================================================================

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
    -- Skip si l'utilisateur existe déjà
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = r.username || '@coslbloobiz.local') THEN
      RAISE NOTICE 'User % déjà existant, skip', r.username;
      CONTINUE;
    END IF;

    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
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
      now(),
      now(),
      '', '', '', ''
    );

    -- Identité associée (requis par GoTrue >= 2.x)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', r.username || '@coslbloobiz.local', 'email_verified', true),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );

    -- Profil applicatif
    INSERT INTO public.user_profiles (id, username, full_name, email, role)
    VALUES (v_user_id, r.username, r.full_name, r.username || '@coslbloobiz.local', r.role::public.user_role)
    ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          username = EXCLUDED.username;

    RAISE NOTICE 'Créé : % (%)', r.username, r.role;
  END LOOP;
END $$;

-- Vérification
SELECT u.email, p.username, p.role
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE u.email LIKE '%@coslbloobiz.local'
ORDER BY p.role;
