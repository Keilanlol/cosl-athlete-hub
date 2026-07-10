-- ============================================================================
-- 41 UP. Ajout du champ last_medical_check sur athletes
-- ============================================================================
-- Date du dernier examen médical sportif.
-- ============================================================================

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS last_medical_check date;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0041', 'athlete_last_medical_check')
ON CONFLICT (version) DO NOTHING;