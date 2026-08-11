-- ============================================================================
-- 64 DOWN. Rollback de la migration 64
-- ============================================================================
-- Restaure les policies permissives d'origine sur user_profiles.
-- ⚠️ Ce rollback réintroduit la faille de sécurité. À utiliser uniquement
--    en cas de problème critique nécessitant un retour arrière.
-- ============================================================================

BEGIN;

-- ── Supprimer le trigger et la fonction de protection ───────────────────────
DROP TRIGGER IF EXISTS trg_protect_user_profile_columns ON public.user_profiles;
DROP FUNCTION IF EXISTS public.protect_user_profile_columns();

-- ── Supprimer les policies restrictives ─────────────────────────────────────
DROP POLICY IF EXISTS user_profiles_select_self ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete_admin ON public.user_profiles;

-- ── Supprimer la RPC resolve_username_email ─────────────────────────────────
DROP FUNCTION IF EXISTS public.resolve_username_email(text);

-- ── Supprimer get_current_user_role (créée par la 64, recréée par la 56) ────
-- On ne la supprime que si la 56 n'a pas été appliquée. Pour la sécurité du
-- rollback, on la laisse en place si la 56 est appliquée.
-- En pratique, on la supprime toujours : la 56 la recréera si besoin.
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- ── Restaurer les policies permissives d'origine ────────────────────────────
CREATE POLICY user_profiles_all ON public.user_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "username lookup public" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

-- ── Retirer la migration du tracking ────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0064';

COMMIT;