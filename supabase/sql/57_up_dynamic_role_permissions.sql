-- ============================================================================
-- 57 UP. Système de permissions dynamiques par rôle
-- ============================================================================
-- 1. Tables role_permissions (modules) et role_document_access (catégories de docs)
-- 2. Seed des permissions par défaut pour les 6 rôles existants
-- 3. Fonction get_user_permissions(p_user_id) retourne un JSON
-- 4. Policies RLS dynamiques sur les 5 tables prioritaires
-- 5. Conversion de user_profiles.role de enum vers text (pour autoriser
--    de nouveaux rôles créés depuis l'admin)
-- ============================================================================

-- ── 1. Convertir user_profiles.role de enum vers text ──────────────────────
-- L'enum user_role limite à 6 valeurs fixes. On passe en text pour autoriser
-- de nouveaux rôles créés depuis Admin > Types & Rôles (groupe user_roles).
ALTER TABLE public.user_profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_profiles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'reader';

-- ── 2. Table role_permissions (accès par module) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_code   text NOT NULL,
  module      text NOT NULL,
  can_read    boolean NOT NULL DEFAULT false,
  can_write   boolean NOT NULL DEFAULT false,
  can_delete  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_code, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permissions_all ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;

-- ── 3. Table role_document_access (accès par catégorie de document) ─────────
CREATE TABLE IF NOT EXISTS public.role_document_access (
  role_code     text NOT NULL,
  doc_category  text NOT NULL,
  can_read      boolean NOT NULL DEFAULT false,
  can_write     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_code, doc_category)
);

ALTER TABLE public.role_document_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_document_access_all ON public.role_document_access;
CREATE POLICY role_document_access_select ON public.role_document_access
  FOR SELECT TO authenticated USING (true);
CREATE POLICY role_document_access_write ON public.role_document_access
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_document_access TO authenticated;

-- ── 4. Seed des permissions par défaut ──────────────────────────────────────
-- Modules : persons, athletes, documents, accreditations, games, logistics,
--           communication, admin, federations, clubs, selections, events

INSERT INTO public.role_permissions (role_code, module, can_read, can_write, can_delete) VALUES
  -- admin : tout
  ('admin', 'persons', true, true, true),
  ('admin', 'athletes', true, true, true),
  ('admin', 'documents', true, true, true),
  ('admin', 'accreditations', true, true, true),
  ('admin', 'games', true, true, true),
  ('admin', 'logistics', true, true, true),
  ('admin', 'communication', true, true, true),
  ('admin', 'federations', true, true, true),
  ('admin', 'clubs', true, true, true),
  ('admin', 'selections', true, true, true),
  ('admin', 'events', true, true, true),
  ('admin', 'admin', true, true, true),

  -- games_manager : tout sauf admin
  ('games_manager', 'persons', true, true, true),
  ('games_manager', 'athletes', true, true, true),
  ('games_manager', 'documents', true, true, true),
  ('games_manager', 'accreditations', true, true, true),
  ('games_manager', 'games', true, true, true),
  ('games_manager', 'logistics', true, true, true),
  ('games_manager', 'communication', true, true, true),
  ('games_manager', 'federations', true, true, false),
  ('games_manager', 'clubs', true, true, false),
  ('games_manager', 'selections', true, true, true),
  ('games_manager', 'events', true, true, true),
  ('games_manager', 'admin', true, false, false),

  -- fed_manager : lecture générale, écriture limitée
  ('fed_manager', 'persons', true, true, false),
  ('fed_manager', 'athletes', true, true, false),
  ('fed_manager', 'documents', true, true, false),
  ('fed_manager', 'accreditations', true, false, false),
  ('fed_manager', 'games', true, false, false),
  ('fed_manager', 'logistics', true, false, false),
  ('fed_manager', 'communication', true, false, false),
  ('fed_manager', 'federations', true, true, true),
  ('fed_manager', 'clubs', true, false, false),
  ('fed_manager', 'selections', true, false, false),
  ('fed_manager', 'events', true, true, false),
  ('fed_manager', 'admin', false, false, false),

  -- logistics : logistique uniquement + lecture personnes
  ('logistics', 'persons', true, false, false),
  ('logistics', 'athletes', true, false, false),
  ('logistics', 'documents', false, false, false),
  ('logistics', 'accreditations', true, false, false),
  ('logistics', 'games', true, false, false),
  ('logistics', 'logistics', true, true, true),
  ('logistics', 'communication', false, false, false),
  ('logistics', 'federations', true, false, false),
  ('logistics', 'clubs', true, false, false),
  ('logistics', 'selections', true, false, false),
  ('logistics', 'events', true, false, false),
  ('logistics', 'admin', false, false, false),

  -- communication : communication + lecture
  ('communication', 'persons', true, true, false),
  ('communication', 'athletes', true, false, false),
  ('communication', 'documents', true, false, false),
  ('communication', 'accreditations', true, false, false),
  ('communication', 'games', true, false, false),
  ('communication', 'logistics', true, false, false),
  ('communication', 'communication', true, true, true),
  ('communication', 'federations', true, false, false),
  ('communication', 'clubs', true, false, false),
  ('communication', 'selections', true, false, false),
  ('communication', 'events', true, true, false),
  ('communication', 'admin', false, false, false),

  -- reader : lecture uniquement, pas d'admin
  ('reader', 'persons', true, false, false),
  ('reader', 'athletes', true, false, false),
  ('reader', 'documents', true, false, false),
  ('reader', 'accreditations', true, false, false),
  ('reader', 'games', true, false, false),
  ('reader', 'logistics', true, false, false),
  ('reader', 'communication', true, false, false),
  ('reader', 'federations', true, false, false),
  ('reader', 'clubs', true, false, false),
  ('reader', 'selections', true, false, false),
  ('reader', 'events', true, false, false),
  ('reader', 'admin', false, false, false)
ON CONFLICT (role_code, module) DO NOTHING;

-- ── 5. Seed des accès par catégorie de document ────────────────────────────
INSERT INTO public.role_document_access (role_code, doc_category, can_read, can_write) VALUES
  -- admin : tout
  ('admin', 'admin', true, true),
  ('admin', 'medical', true, true),
  ('admin', 'sportive', true, true),
  ('admin', 'contractual', true, true),

  -- games_manager : tout
  ('games_manager', 'admin', true, true),
  ('games_manager', 'medical', true, true),
  ('games_manager', 'sportive', true, true),
  ('games_manager', 'contractual', true, true),

  -- fed_manager : tout en lecture, écriture sauf medical
  ('fed_manager', 'admin', true, true),
  ('fed_manager', 'medical', true, false),
  ('fed_manager', 'sportive', true, true),
  ('fed_manager', 'contractual', true, true),

  -- logistics : pas de documents
  ('logistics', 'admin', false, false),
  ('logistics', 'medical', false, false),
  ('logistics', 'sportive', false, false),
  ('logistics', 'contractual', false, false),

  -- communication : lecture uniquement
  ('communication', 'admin', true, false),
  ('communication', 'medical', true, false),
  ('communication', 'sportive', true, false),
  ('communication', 'contractual', true, false),

  -- reader : lecture sauf medical et admin (identité)
  ('reader', 'admin', false, false),
  ('reader', 'medical', false, false),
  ('reader', 'sportive', true, false),
  ('reader', 'contractual', true, false)
ON CONFLICT (role_code, doc_category) DO NOTHING;

-- ── 6. Fonction get_user_permissions(p_user_id) ─────────────────────────────
-- Retourne un JSON avec les permissions de l'utilisateur
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'role', up.role,
    'modules', COALESCE((
      SELECT json_object_agg(
        rp.module,
        json_build_object('can_read', rp.can_read, 'can_write', rp.can_write, 'can_delete', rp.can_delete)
      )
      FROM public.role_permissions rp
      WHERE rp.role_code = up.role
    ), '{}'::json),
    'document_access', COALESCE((
      SELECT json_object_agg(
        rda.doc_category,
        json_build_object('can_read', rda.can_read, 'can_write', rda.can_write)
      )
      FROM public.role_document_access rda
      WHERE rda.role_code = up.role
    ), '{}'::json)
  )
  FROM public.user_profiles up
  WHERE up.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- ── 7. Helper : vérifier une permission module ──────────────────────────────
CREATE OR REPLACE FUNCTION public.can_access(p_module text, p_action text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (rp.can_read AND p_action = 'read') OR (rp.can_write AND p_action IN ('write', 'read')) OR (rp.can_delete AND p_action = 'delete')
     FROM public.role_permissions rp
     JOIN public.user_profiles up ON up.id = auth.uid()
     WHERE rp.role_code = up.role AND rp.module = p_module),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access(text, text) TO authenticated;

-- ── 8. Policies RLS dynamiques sur les 5 tables prioritaires ────────────────

-- person_documents : utilise role_document_access
DROP POLICY IF EXISTS person_documents_select ON public.person_documents;
DROP POLICY IF EXISTS person_documents_write ON public.person_documents;

CREATE POLICY person_documents_select ON public.person_documents
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.role_document_access rda
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE rda.role_code = up.role
        AND rda.can_read = true
        AND rda.doc_category = COALESCE(person_documents.category, 'admin')
    )
  );

CREATE POLICY person_documents_write ON public.person_documents
  FOR ALL TO authenticated
  USING (
    public.get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.role_document_access rda
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE rda.role_code = up.role
        AND rda.can_write = true
        AND rda.doc_category = COALESCE(person_documents.category, 'admin')
    )
  )
  WITH CHECK (
    public.get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.role_document_access rda
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE rda.role_code = up.role
        AND rda.can_write = true
        AND rda.doc_category = COALESCE(person_documents.category, 'admin')
    )
  );

-- accreditation_requirements : utilise role_permissions module 'accreditations'
DROP POLICY IF EXISTS accreditation_requirements_select ON public.accreditation_requirements;
DROP POLICY IF EXISTS accreditation_requirements_write ON public.accreditation_requirements;

CREATE POLICY accreditation_requirements_select ON public.accreditation_requirements
  FOR SELECT TO authenticated
  USING (public.can_access('accreditations', 'read'));

CREATE POLICY accreditation_requirements_write ON public.accreditation_requirements
  FOR ALL TO authenticated
  USING (public.can_access('accreditations', 'write'))
  WITH CHECK (public.can_access('accreditations', 'write'));

-- app_type_items : utilise module 'admin'
DROP POLICY IF EXISTS app_type_items_select ON public.app_type_items;
DROP POLICY IF EXISTS app_type_items_write ON public.app_type_items;

CREATE POLICY app_type_items_select ON public.app_type_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY app_type_items_write ON public.app_type_items
  FOR ALL TO authenticated
  USING (public.can_access('admin', 'write'))
  WITH CHECK (public.can_access('admin', 'write'));

-- events : utilise module 'events'
DROP POLICY IF EXISTS events_select ON public.events;
DROP POLICY IF EXISTS events_write ON public.events;

CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (public.can_access('events', 'read'));

CREATE POLICY events_write ON public.events
  FOR ALL TO authenticated
  USING (public.can_access('events', 'write'))
  WITH CHECK (public.can_access('events', 'write'));

-- person_events : utilise module 'events'
DROP POLICY IF EXISTS person_events_select ON public.person_events;
DROP POLICY IF EXISTS person_events_write ON public.person_events;

CREATE POLICY person_events_select ON public.person_events
  FOR SELECT TO authenticated
  USING (public.can_access('events', 'read'));

CREATE POLICY person_events_write ON public.person_events
  FOR ALL TO authenticated
  USING (public.can_access('events', 'write'))
  WITH CHECK (public.can_access('events', 'write'));

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0057', 'dynamic_role_permissions')
ON CONFLICT (version) DO NOTHING;