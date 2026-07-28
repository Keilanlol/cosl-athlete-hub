-- ============================================================================
-- 47 UP. Passe en ON DELETE RESTRICT les FK person_id des tables porteuses
--       d'historique métier.
-- ============================================================================
-- Problème : les FK person_id en ON DELETE CASCADE sur person_documents,
-- selections, accreditations, delegation_members, game_volunteers, person_events
-- effacent en cascade l'historique (passeports, fiches médicales, sélections
-- tous Games confondus, accréditations et leurs documents, appartenances aux
-- délégations officielles) lors de la suppression d'une personne.
--
-- Désormais : RESTRICT sur les tables d'historique, CASCADE conservé sur les
-- tables de structure pure (person_roles, *_profiles).
--
-- Note : les fichiers du storage liés à person_documents ne sont JAMAIS
-- supprimés par une cascade SQL. Même en CASCADE, seul l'enregistrement de
-- la table disparaît — le fichier dans le bucket reste orphelin.
-- Avec RESTRICT, la suppression est bloquée avant même d'atteindre les fichiers.
-- ============================================================================

-- ── 1. Snapshot des contraintes FK avant modification ───────────────────────
-- Sauvegarde les noms de contraintes et leur comportement ON DELETE actuel.
-- Permet de restaurer les contraintes exactes en cas de rollback.

DROP TABLE IF EXISTS migration_47_snapshot_fk_constraints;
CREATE TABLE migration_47_snapshot_fk_constraints AS
SELECT
  con.conname,
  cl.relname,
  a.attname,
  con.confdeltype
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
WHERE nsp.nspname = 'public'
  AND con.contype = 'f'
  AND cl.relname IN ('person_documents','selections','accreditations',
                     'delegation_members','game_volunteers','person_events')
  AND a.attname = 'person_id';

-- ── 2. Remplacer CASCADE par RESTRICT sur les tables d'historique ───────────
-- Postgres ne permet pas ALTER CONSTRAINT pour changer ON DELETE.
-- On drop puis recrée.

-- 2a. person_documents
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'person_documents'
      AND con.contype = 'f'
      AND att.attname = 'person_id'
  LOOP
    EXECUTE format('ALTER TABLE public.person_documents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.person_documents
  ADD CONSTRAINT person_documents_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE RESTRICT;

-- 2b. selections
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'selections'
      AND con.contype = 'f'
      AND att.attname = 'person_id'
  LOOP
    EXECUTE format('ALTER TABLE public.selections DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.selections
  ADD CONSTRAINT selections_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE RESTRICT;

-- 2c. accreditations
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'accreditations'
      AND con.contype = 'f'
      AND att.attname = 'person_id'
  LOOP
    EXECUTE format('ALTER TABLE public.accreditations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.accreditations
  ADD CONSTRAINT accreditations_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE RESTRICT;

-- 2d. delegation_members
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'delegation_members'
      AND con.contype = 'f'
      AND att.attname = 'person_id'
  LOOP
    EXECUTE format('ALTER TABLE public.delegation_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.delegation_members
  ADD CONSTRAINT delegation_members_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE RESTRICT;

-- 2e. game_volunteers
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'game_volunteers'
      AND con.contype = 'f'
      AND att.attname = 'person_id'
  LOOP
    EXECUTE format('ALTER TABLE public.game_volunteers DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.game_volunteers
  ADD CONSTRAINT game_volunteers_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE RESTRICT;

-- 2f. person_events
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'person_events'
      AND con.contype = 'f'
      AND att.attname = 'person_id'
  LOOP
    EXECUTE format('ALTER TABLE public.person_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.person_events
  ADD CONSTRAINT person_events_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE RESTRICT;

-- ── 3. Vérification : toutes les FK sont maintenant en RESTRICT (code 'r') ───
-- confdeltype = 'r' signifie RESTRICT, 'c' signifie CASCADE.
-- SELECT relname, conname, confdeltype
-- FROM pg_constraint con
-- JOIN pg_class cl ON cl.oid = con.conrelid
-- JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
-- JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
-- WHERE nsp.nspname = 'public'
--   AND con.contype = 'f'
--   AND a.attname = 'person_id'
--   AND cl.relname IN ('person_documents','selections','accreditations',
--                      'delegation_members','game_volunteers','person_events');
-- Résultat attendu : 6 lignes, toutes avec confdeltype = 'r'.

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0047', 'restrict_person_delete_cascades')
ON CONFLICT (version) DO NOTHING;