-- ============================================================================
-- 64 DOWN. Rollback de la migration 64
-- ============================================================================
-- Restaure les policies permissives d'origine sur user_profiles.
-- ⚠️ Ce rollback réintroduit la faille de sécurité. À utiliser uniquement
--    en cas de problème critique nécessitant un retour arrière.
-- ============================================================================

BEGIN;

-- ── Supprimer les policies restrictives ─────────────────────────────────────
DROP POLICY IF EXISTS user_profiles_select_self ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete_admin ON public.user_profiles;

-- ── Restaurer les policies permissives d'origine ────────────────────────────
CREATE POLICY user_profiles_all ON public.user_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "username lookup public" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

-- ── Supprimer la vue v_username_lookup ──────────────────────────────────────
DROP VIEW IF EXISTS public.v_username_lookup;

-- ── Retirer la migration du tracking ────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0064';

COMMIT;