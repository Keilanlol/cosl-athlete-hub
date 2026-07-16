-- ============================================================================
-- 44 UP. RLS policies for person_documents + accreditation_requirements
-- ============================================================================
-- La migration 43 a créé les tables mais sans activer RLS ni créer de policies.
-- Supabase bloque par défaut les opérations sur les tables sans policy explicite.
-- Cette migration corrige le problème "vous n'avez pas les droits".
-- ============================================================================

-- ── person_documents : RLS permissive (contrôle géré côté frontend) ────────
ALTER TABLE public.person_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_documents_all ON public.person_documents;
CREATE POLICY person_documents_all ON public.person_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_documents TO authenticated;

-- ── accreditation_requirements : RLS permissive ─────────────────────────────
ALTER TABLE public.accreditation_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accreditation_requirements_all ON public.accreditation_requirements;
CREATE POLICY accreditation_requirements_all ON public.accreditation_requirements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accreditation_requirements TO authenticated;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0044', 'rls_person_documents_accred_requirements')
ON CONFLICT (version) DO NOTHING;