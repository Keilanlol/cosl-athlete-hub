-- 36_username_generation_and_password_visibility.sql
-- 1. Stocke le mot de passe en clair (visible uniquement aux admins via la page Comptes COSL)
-- 2. Génère automatiquement le username prenom.nom (avec suffixe incrémental si collision)

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- Colonne plain_password
-- ============================================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS plain_password text;

-- Backfill superadmin (mot de passe défini dans 00_fresh_install)
UPDATE public.user_profiles
   SET plain_password = 'CoslBloobiz_2026Administrateur'
 WHERE username = 'admin'
   AND (plain_password IS NULL OR plain_password = '');

-- ============================================================================
-- Helpers : slugify + generate_unique_username
-- ============================================================================
CREATE OR REPLACE FUNCTION public.slugify_name(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    lower(translate(
      coalesce(p, ''),
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝŸýÿßÆæŒœ',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOoooooouUUUuuuuYYyysAaOo'
    )),
    '[^a-z0-9]+', '', 'g'
  )
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_username(
  p_first text,
  p_last  text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := public.slugify_name(p_first);
  v_last  text := public.slugify_name(p_last);
  v_base  text;
  v_candidate text;
  v_i int := 0;
BEGIN
  IF v_first = '' OR v_last = '' THEN
    RAISE EXCEPTION 'first_name and last_name required';
  END IF;

  v_base := v_first || '.' || v_last;
  v_candidate := v_base;

  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = v_candidate) LOOP
    v_i := v_i + 1;
    v_candidate := v_base || v_i::text;
  END LOOP;

  RETURN v_candidate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_unique_username(text, text) TO authenticated;

-- ============================================================================
-- Nouveau RPC : création de compte avec prénom / nom (username auto)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_account_v2(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_password   text,
  p_role       public.user_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_user_id     uuid;
  v_email       text;
  v_username    text;
  v_fullname    text;
BEGIN
  SELECT role INTO v_caller_role
    FROM public.user_profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF p_first_name IS NULL OR trim(p_first_name) = ''
     OR p_last_name IS NULL OR trim(p_last_name) = '' THEN
    RAISE EXCEPTION 'first_name and last_name required';
  END IF;
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'password too short (min 8 chars)';
  END IF;

  v_username := public.generate_unique_username(p_first_name, p_last_name);
  v_fullname := trim(p_first_name) || ' ' || trim(p_last_name);
  v_email    := coalesce(nullif(trim(p_email), ''), v_username || '@coslbloobiz.local');

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'email already exists';
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
    jsonb_build_object('username', v_username, 'full_name', v_fullname, 'role', p_role::text),
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

  INSERT INTO public.user_profiles (id, username, full_name, email, role, plain_password)
  VALUES (v_user_id, v_username, v_fullname, v_email, p_role, p_password)
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        plain_password = EXCLUDED.plain_password;

  RETURN jsonb_build_object('id', v_user_id, 'username', v_username);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_account_v2(text,text,text,text,public.user_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_account_v2(text,text,text,text,public.user_role) TO authenticated;
