-- ============================================================================
-- 37. RÉFÉRENTIEL UNIFIÉ — Types / Rôles / Catégories éditables depuis l'admin
-- ============================================================================
-- Une seule table générique qui remplace les constantes hardcodées du frontend
-- et rend tous les types éditables dynamiquement.
-- Chaque entrée est identifiée par (group_key, code) et possède un label + sort_order.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_type_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key   text        NOT NULL,
  code        text        NOT NULL,
  label       text        NOT NULL,
  sort_order  int         NOT NULL DEFAULT 0,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_key, code)
);

-- ── RLS permissive (contrôle admin géré côté frontend) ──────────────────────
ALTER TABLE public.app_type_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_type_items_all ON public.app_type_items;
CREATE POLICY app_type_items_all ON public.app_type_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_type_items TO authenticated;

-- ── Seed initial : tous les types/rôles/catégories du système ───────────────
INSERT INTO public.app_type_items (group_key, code, label, sort_order, is_system) VALUES
  -- Rôles des comptes COSL (user_role)
  ('user_roles', 'admin',          'Administrateur',  1,  true),
  ('user_roles', 'games_manager',  'Games Manager',   2,  true),
  ('user_roles', 'fed_manager',    'Fed. Manager',    3,  true),
  ('user_roles', 'logistics',      'Logistique',      4,  true),
  ('user_roles', 'communication',  'Communication',   5,  true),
  ('user_roles', 'reader',         'Lecteur',          6,  true),

  -- Statuts des athlètes (athlete_status)
  ('athlete_statuses', 'active',     'Actif',      1, true),
  ('athlete_statuses', 'injured',    'Blessé',     2, true),
  ('athlete_statuses', 'suspended',  'Suspendu',   3, true),
  ('athlete_statuses', 'retired',    'Retraité',   4, true),
  ('athlete_statuses', 'ambassador', 'Ambassadeur',5, true),

  -- Niveaux des athlètes (athlete_level)
  ('athlete_levels', 'elite',            'Élite',              1, true),
  ('athlete_levels', 'promotion',        'Promotion',          2, true),
  ('athlete_levels', 'espoir',           'Espoir',             3, true),
  ('athlete_levels', 'olympic_contract', 'Contrat olympique',  4, true),

  -- Types de jeux (game_type)
  ('game_types', 'jo_summer',       'JO été',          1, true),
  ('game_types', 'jo_winter',       'JO hiver',        2, true),
  ('game_types', 'joj_summer',      'JOJ été',         3, true),
  ('game_types', 'joj_winter',      'JOJ hiver',       4, true),
  ('game_types', 'jpee',            'JPEE',            5, true),
  ('game_types', 'european_games',  'European Games',  6, true),
  ('game_types', 'eyof_summer',     'EYOF été',        7, true),
  ('game_types', 'eyof_winter',     'EYOF hiver',      8, true),
  ('game_types', 'other',           'Autre',           9, true),

  -- Statuts des jeux (game_status)
  ('game_statuses', 'preparation',  'Préparation', 1, true),
  ('game_statuses', 'in_progress',  'En cours',    2, true),
  ('game_statuses', 'finished',     'Terminé',     3, true),
  ('game_statuses', 'archived',     'Archivé',     4, true),

  -- Catégories d'accréditation (accreditation_category)
  ('accreditation_categories', 'athlete', 'Athlète',  1, true),
  ('accreditation_categories', 'coach',  'Coach',    2, true),
  ('accreditation_categories', 'official','Officiel', 3, true),
  ('accreditation_categories', 'medical','Médical',   4, true),
  ('accreditation_categories', 'press',  'Presse',   5, true),
  ('accreditation_categories', 'vip',    'VIP',      6, true),

  -- Statuts d'accréditation (accreditation_status)
  ('accreditation_statuses', 'draft',     'Brouillon',  1, true),
  ('accreditation_statuses', 'submitted', 'Soumise',    2, true),
  ('accreditation_statuses', 'validated', 'Validée',    3, true),
  ('accreditation_statuses', 'rejected',  'Rejetée',    4, true),
  ('accreditation_statuses', 'produced',  'Produite',   5, true),
  ('accreditation_statuses', 'delivered', 'Délivrée',   6, true),

  -- Catégories de documents (document_category)
  ('document_categories', 'admin',       'Administratif', 1, true),
  ('document_categories', 'medical',     'Médical',        2, true),
  ('document_categories', 'sportive',    'Sportif',        3, true),
  ('document_categories', 'contractual', 'Contractuel',    4, true),

  -- Statuts de documents (document_status)
  ('document_statuses', 'missing',  'Manquant',    1, true),
  ('document_statuses', 'pending',  'En attente',  2, true),
  ('document_statuses', 'valid',    'Valide',      3, true),
  ('document_statuses', 'expired',  'Expiré',      4, true),
  ('document_statuses', 'rejected', 'Rejeté',      5, true),

  -- Statuts de voyage (travel_status)
  ('travel_statuses', 'planned',   'Planifié',   1, true),
  ('travel_statuses', 'confirmed', 'Confirmé',   2, true),
  ('travel_statuses', 'modified',  'Modifié',    3, true),
  ('travel_statuses', 'cancelled', 'Annulé',     4, true),

  -- Statuts de sélection (selection_status)
  ('selection_statuses', 'pre_selected', 'Pré-sélectionné', 1, true),
  ('selection_statuses', 'selected',     'Sélectionné',     2, true),
  ('selection_statuses', 'reserve',      'Réserve',         3, true),
  ('selection_statuses', 'rejected',     'Rejeté',          4, true),

  -- Statuts KYC (kyc_status)
  ('kyc_statuses', 'green',  'Vert',   1, true),
  ('kyc_statuses', 'orange', 'Orange', 2, true),
  ('kyc_statuses', 'red',    'Rouge',  3, true),

  -- Rôles des encadrants (COACH_ROLES)
  ('coach_roles', 'coach',          'Coach',            1, true),
  ('coach_roles', 'manager',        'Manager',          2, true),
  ('coach_roles', 'medical',        'Médical',          3, true),
  ('coach_roles', 'official',       'Officiel',         4, true),
  ('coach_roles', 'chief_of_mission','Chef de mission', 5, true),
  ('coach_roles', 'press',          'Presse',           6, true),
  ('coach_roles', 'physio',         'Physiothérapeute', 7, true),
  ('coach_roles', 'logistics',      'Logistique',       8, true),

  -- Rôles des membres de fédération (FEDERATION_MEMBER_ROLES)
  ('federation_member_roles', 'president',        'Président',         1, true),
  ('federation_member_roles', 'vice_president',   'Vice-président',    2, true),
  ('federation_member_roles', 'secretary_general','Secrétaire général',3, true),
  ('federation_member_roles', 'treasurer',        'Trésorier',         4, true),
  ('federation_member_roles', 'board_member',     'Membre du bureau',  5, true),
  ('federation_member_roles', 'delegate',         'Délégué',           6, true),
  ('federation_member_roles', 'other',            'Autre',             7, true),

  -- Rôles des membres de club (CLUB_MEMBER_ROLES)
  ('club_member_roles', 'president',   'Président',          1, true),
  ('club_member_roles', 'vice_president','Vice-président',   2, true),
  ('club_member_roles', 'secretary',   'Secrétaire',         3, true),
  ('club_member_roles', 'treasurer',   'Trésorier',          4, true),
  ('club_member_roles', 'board_member','Membre du bureau',   5, true),
  ('club_member_roles', 'head_coach',  'Entraîneur principal',6, true),
  ('club_member_roles', 'other',       'Autre',              7, true),

  -- Types de rôle personne (person_role_type)
  ('person_role_types', 'athlete',          'Athlète',            1, true),
  ('person_role_types', 'coach',            'Coach',              2, true),
  ('person_role_types', 'federation_member','Membre fédération',  3, true),
  ('person_role_types', 'club_member',      'Membre club',        4, true),
  ('person_role_types', 'official',         'Officiel',           5, true),
  ('person_role_types', 'volunteer',        'Bénévole',           6, true),
  ('person_role_types', 'staff',            'Staff',              7, true)

ON CONFLICT (group_key, code) DO NOTHING;