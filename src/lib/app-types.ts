// ─────────────────────────────────────────────────────────────────────────────
// Types et métadonnées des groupes app_type_items
// ─────────────────────────────────────────────────────────────────────────────
// Le hook useAppTypes est désormais dans src/hooks/useTypeItems.ts
// (fusionné avec useTypeItems pour un cache partagé React Query).
// Ce fichier ne contient que les types et métadonnées statiques.

export type AppTypeItem = {
  id: string;
  group_key: string;
  code: string;
  label: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
};

export type AppTypeGroupMeta = {
  key: string;
  label: string;
  description: string;
};

export type AppTypeGroup = AppTypeGroupMeta & {
  items: AppTypeItem[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Métadonnées d'affichage des groupes (ordre et traduction FR)
// ─────────────────────────────────────────────────────────────────────────────

export const APP_TYPE_GROUPS: AppTypeGroupMeta[] = [
  { key: "user_roles",                label: "Rôles des comptes COSL",    description: "Rôles attribuables aux utilisateurs de la plateforme" },
  { key: "athlete_statuses",           label: "Statuts des athlètes",       description: "Cycle de vie d'un athlète" },
  { key: "athlete_levels",             label: "Niveaux d'athlètes",         description: "Niveaux de performance des athlètes" },
  { key: "game_types",                 label: "Types de jeux",              description: "JO, JOJ, JPEE, EYOF, European Games, etc." },
  { key: "game_statuses",              label: "Statuts des jeux",            description: "État d'avancement d'une édition" },
  { key: "accreditation_categories",   label: "Catégories d'accréditation", description: "Catégories de personnes accréditées" },
  { key: "accreditation_statuses",     label: "Statuts d'accréditation",     description: "Cycle de validation des accréditations" },
  { key: "document_types",             label: "Types de documents",         description: "Types de documents pour accréditations (passeport, convention, etc.)" },
  { key: "document_categories",        label: "Catégories de documents",    description: "Classification des documents athlètes" },
  { key: "document_statuses",          label: "Statuts de documents",       description: "État d'un document (valide, expiré, etc.)" },
  { key: "travel_statuses",            label: "Statuts de voyage",           description: "État d'un plan de voyage" },
  { key: "travel_scopes",              label: "Portées de voyage",           description: "Global, sport, individuel" },
  { key: "selection_statuses",         label: "Statuts de sélection",       description: "État d'une sélection d'athlète" },
  { key: "kyc_statuses",               label: "Statuts KYC",                description: "Code couleur des axes KYC" },
  { key: "coach_roles",                label: "Rôles des encadrants",       description: "Rôles des coachs et encadrants" },
  { key: "federation_member_roles",    label: "Rôles des membres de fédération", description: "Rôles des membres d'une fédération" },
  { key: "club_member_roles",          label: "Rôles des membres de club",  description: "Rôles des membres d'un club" },
  { key: "person_role_types",          label: "Types de rôle personne",     description: "Types de rôles pour la super-classe Personne" },
  { key: "competition_rounds",         label: "Rounds de compétition",      description: "Finale, demi-finale, quart, séries, etc." },
  { key: "transport_types",            label: "Types de transport",         description: "Navette, bus, train, etc. (logistique locale)" },
  { key: "accommodation_types",        label: "Types d'hébergement",         description: "Hôtel, résidence, village, etc." },
  { key: "room_types",                 label: "Types de chambre",           description: "Single, double, twin, triple, suite, etc." },
  { key: "notification_types",         label: "Types de notification",      description: "Types d'alertes système" },
  { key: "genders",                    label: "Genres",                    description: "Masculin, féminin, mixte" },
  { key: "medal_types",               label: "Types de médaille",          description: "Or, argent, bronze" },
];

export const APP_TYPE_GROUP_KEYS = APP_TYPE_GROUPS.map((g) => g.key);