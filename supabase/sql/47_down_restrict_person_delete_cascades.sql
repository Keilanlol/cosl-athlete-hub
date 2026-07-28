-- ============================================================================
-- 47 DOWN. Rollback — restaure les FK person_id en ON DELETE CASCADE
-- ============================================================================
-- Restaure les contraintes FK depuis le snapshot. Remet CASCADE partout.
-- ============================================================================

-- ── 1. Drop les contraintes RESTRICT ────────────────────────────────────────
ALTER TABLE public.person_documents     DROP CONSTRAINT IF EXISTS person_documents_person_id_fkey;
ALTER TABLE public.selections           DROP CONSTRAINT IF EXISTS selections_person_id_fkey;
ALTER TABLE public.accreditations        DROP CONSTRAINT IF EXISTS accreditations_person_id_fkey;
ALTER TABLE public.delegation_members    DROP CONSTRAINT IF EXISTS delegation_members_person_id_fkey;
ALTER TABLE public.game_volunteers       DROP CONSTRAINT IF EXISTS game_volunteers_person_id_fkey;
ALTER TABLE public.person_events         DROP CONSTRAINT IF EXISTS person_events_person_id_fkey;

-- ── 2. Recréer en CASCADE ──────────────────────────────────────────────────
ALTER TABLE public.person_documents
  ADD CONSTRAINT person_documents_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;

ALTER TABLE public.selections
  ADD CONSTRAINT selections_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;

ALTER TABLE public.accreditations
  ADD CONSTRAINT accreditations_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;

ALTER TABLE public.delegation_members
  ADD CONSTRAINT delegation_members_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;

ALTER TABLE public.game_volunteers
  ADD CONSTRAINT game_volunteers_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;

ALTER TABLE public.person_events
  ADD CONSTRAINT person_events_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;

-- ── 3. Nettoyer le snapshot (optionnel — conserver pour sécurité) ───────────
-- DROP TABLE IF EXISTS migration_47_snapshot_fk_constraints;

-- ── 4. Retirer la migration du tracking ─────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0047';