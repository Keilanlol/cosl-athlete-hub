-- 35_fix_admin_create_account_pgcrypto_schema.sql
-- Correctif pour Supabase : pgcrypto est dans le schéma "extensions".
-- À exécuter dans le SQL Editor si la création de compte échoue avec :
-- function gen_salt(unknown) does not exist

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
    extensions.crypt(p_password, extensions.gen_salt('bf')),
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