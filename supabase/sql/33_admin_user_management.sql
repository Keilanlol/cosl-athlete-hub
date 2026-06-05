-- 33_admin_user_management.sql
-- RPCs sécurisées pour permettre à un admin de créer/supprimer des comptes
-- depuis l'application (sans Edge Function).
-- Le "superadmin" est identifié par username = 'admin' : il ne peut être
-- supprimé depuis l'app et n'apparaît pas dans la liste des comptes.

-- ============================================================================
-- 1. Création d'un compte (admin uniquement)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_account(
  p_username  text,
  p_full_name text,
  p_email     text,
  p_password  text,
  p_role      public.user_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_user_id     uuid;
  v_email       text;
  v_username    text;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT role INTO v_caller_role
    FROM public.user_profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  v_username := lower(trim(p_username));
  IF v_username = '' OR p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'username and full_name required';
  END IF;
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'password too short (min 8 chars)';
  END IF;

  v_email := coalesce(nullif(trim(p_email), ''), v_username || '@coslbloobiz.local');

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'email already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE username = v_username) THEN
    RAISE EXCEPTION 'username already exists';
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
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider','email','providers',ARRAY['email']),
    jsonb_build_object('username', v_username, 'full_name', trim(p_full_name), 'role', p_role::text),
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.user_profiles (id, username, full_name, email, role)
  VALUES (v_user_id, v_username, trim(p_full_name), v_email, p_role)
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_account(text,text,text,text,public.user_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_account(text,text,text,text,public.user_role) TO authenticated;

-- ============================================================================
-- 2. Suppression d'un compte (admin uniquement, hors self & superadmin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_target_username text;
BEGIN
  SELECT role INTO v_caller_role
    FROM public.user_profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete your own account';
  END IF;

  SELECT username INTO v_target_username
    FROM public.user_profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;
  IF v_target_username = 'admin' THEN
    RAISE EXCEPTION 'cannot delete the superadmin account';
  END IF;

  -- ON DELETE CASCADE depuis auth.users → user_profiles
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_account(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid) TO authenticated;
