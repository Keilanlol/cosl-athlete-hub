import { supabase } from "@/lib/supabase";
import { normalizeDate } from "@/lib/csv-import";
import type { CsvImportConfig } from "@/lib/csv-import";

// ============================================================
// Athletes
// ============================================================

export const athletesImportConfig: CsvImportConfig = {
  entityName: "Athlète",
  table: "athletes",
  columns: [
    { key: "cosl_id", label: "COSL-2026-0001", autoGenerate: true },
    { key: "first_name", label: "Jean", required: true },
    { key: "last_name", label: "Dupont", required: true },
    { key: "birth_date", label: "1998-05-15", required: true, transform: normalizeDate },
    { key: "gender", label: "male", required: true, transform: (v) => v.toLowerCase(), validateTypeGroup: "genders" },
    { key: "nationality", label: "LUX", required: true, transform: (v) => v.toUpperCase() },
    { key: "sport_nationality", label: "LUX", transform: (v) => (v ? v.toUpperCase() : null) },
    { key: "email", label: "jean.dupont@email.lu" },
    { key: "phone", label: "+352 691 000 000" },
    { key: "street", label: "12 Rue de la Gare" },
    { key: "postcode", label: "L-1234" },
    { key: "city", label: "Luxembourg" },
    { key: "country", label: "LU" },
    { key: "status", label: "active", default: "active", transform: (v) => v.toLowerCase(), validateTypeGroup: "athlete_statuses" },
    { key: "level", label: "elite", validateTypeGroup: "athlete_levels" },
    { key: "license_number", label: "LIC-001" },
    { key: "passport_number", label: "AB1234567" },
    { key: "passport_expiry", label: "2030-01-01", transform: normalizeDate },
    { key: "primary_sport", label: "Athlétisme", linkOnly: true },
    { key: "primary_federation", label: "FLA", linkOnly: true },
    { key: "current_club", label: "FC Luxembourg", linkOnly: true },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["cosl_id"], description: "COSL ID" },
      { keys: ["first_name", "last_name", "birth_date"], description: "nom + date de naissance" },
      { keys: ["email"], description: "email" },
    ],
    updateOnDuplicate: true,
  },
  links: [
    {
      csvColumn: "primary_sport",
      table: "sports",
      matchColumn: "name",
      selectColumns: "id,name",
      createIfMissing: true,
      createColumns: (name) => ({ name }),
      targetColumn: "primary_sport_id",
    },
    {
      csvColumn: "primary_federation",
      table: "federations",
      matchColumn: "acronym",
      selectColumns: "id,acronym",
      createIfMissing: false,
      targetColumn: "primary_federation_id",
    },
    {
      csvColumn: "current_club",
      table: "clubs",
      matchColumn: "name",
      selectColumns: "id,name",
      createIfMissing: false,
      targetColumn: "current_club_id",
    },
  ],
  extraPayload: { is_active: true },
  generateColumn: async (column, existing) => {
    if (column !== "cosl_id") return null;
    const year = new Date().getFullYear();
    const prefix = `COSL-${year}-`;
    const { data } = await supabase
      .from("athletes")
      .select("cosl_id")
      .ilike("cosl_id", `COSL-${year}-%`)
      .order("cosl_id", { ascending: false })
      .limit(1);
    const last = data?.[0]?.cosl_id as string | undefined;
    const seq = last ? parseInt(last.split("-")[2] ?? "0", 10) + 1 : 1;
    const batchMax = existing
      .filter((id) => id.startsWith(prefix))
      .map((id) => parseInt(id.slice(prefix.length), 10))
      .reduce((m, n) => Math.max(m, n), 0);
    return `${prefix}${String(Math.max(seq, batchMax + 1)).padStart(4, "0")}`;
  },
};

// ============================================================
// Persons
// ============================================================

export const personsImportConfig: CsvImportConfig = {
  entityName: "Personne",
  table: "persons",
  columns: [
    { key: "first_name", label: "Jean", required: true },
    { key: "last_name", label: "Dupont", required: true },
    { key: "birth_date", label: "1998-05-15", transform: normalizeDate },
    { key: "gender", label: "male", transform: (v) => (v ? v.toLowerCase() : null) },
    { key: "nationality", label: "LUX", transform: (v) => (v ? v.toUpperCase() : null) },
    { key: "email", label: "jean.dupont@email.lu" },
    { key: "phone", label: "+352 691 000 000" },
    { key: "street", label: "12 Rue de la Gare" },
    { key: "postcode", label: "L-1234" },
    { key: "city", label: "Luxembourg" },
    { key: "country", label: "LU" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["email"], description: "email" },
      { keys: ["first_name", "last_name", "birth_date"], description: "nom + date de naissance" },
    ],
    updateOnDuplicate: true,
  },
  extraPayload: { is_active: true },
};

// ============================================================
// Clubs
// ============================================================

export const clubsImportConfig: CsvImportConfig = {
  entityName: "Club",
  table: "clubs",
  columns: [
    { key: "name", label: "FC Luxembourg", required: true },
    { key: "federation_acronym", label: "FLA", required: true, aliases: ["federation"], linkOnly: true },
    { key: "federation_name", label: "Fédération Luxembourgeoise d'Athlétisme", required: true, linkOnly: true },
    { key: "city", label: "Luxembourg" },
    { key: "street", label: "12 Rue de la Gare" },
    { key: "postcode", label: "L-1234" },
    { key: "country", label: "LU" },
    { key: "email", label: "contact@club.lu" },
    { key: "phone", label: "+352 000 000" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["name"], description: "nom" },
    ],
    updateOnDuplicate: true,
  },
  links: [
    {
      csvColumn: "federation_acronym",
      table: "federations",
      matchColumn: "acronym",
      selectColumns: "id,acronym",
      createIfMissing: false,
      targetColumn: "federation_id",
    },
  ],
};

// ============================================================
// Federations
// ============================================================

export const federationsImportConfig: CsvImportConfig = {
  entityName: "Fédération",
  table: "federations",
  columns: [
    { key: "acronym", label: "FLA", required: true },
    { key: "name", label: "Fédération Luxembourgeoise d'Athlétisme", required: true },
    { key: "president_name", label: "Jean Dupont" },
    { key: "contact_email", label: "contact@fla.lu" },
    { key: "contact_phone", label: "+352 000 000" },
    { key: "international_federation", label: "World Athletics" },
    { key: "is_olympic", label: "true", transform: (v) => v.toLowerCase() === "true" || v === "1" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["acronym"], description: "acronyme" },
      { keys: ["name"], description: "nom" },
    ],
    updateOnDuplicate: true,
  },
};

// ============================================================
// Sponsors
// ============================================================

export const sponsorsImportConfig: CsvImportConfig = {
  entityName: "Sponsor",
  table: "sponsors",
  columns: [
    { key: "name", label: "Sponsor SA", required: true },
    { key: "email", label: "contact@sponsor.lu" },
    { key: "phone", label: "+352 000 000" },
    { key: "contact_first_name", label: "Jean" },
    { key: "contact_last_name", label: "Dupont" },
    { key: "contact_email", label: "jean@sponsor.lu" },
    { key: "contact_phone", label: "+352 691 000" },
    { key: "notes", label: "Notes diverses" },
    { key: "rank", label: "Gold", linkOnly: true },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["name"], description: "nom" },
    ],
    updateOnDuplicate: true,
  },
  links: [
    {
      csvColumn: "rank",
      table: "sponsor_ranks",
      matchColumn: "name",
      selectColumns: "id,name",
      createIfMissing: false,
      targetColumn: "rank_id",
    },
  ],
  extraPayload: { is_active: true },
};

// ============================================================
// Partners
// ============================================================

export const partnersImportConfig: CsvImportConfig = {
  entityName: "Partenaire",
  table: "partners",
  columns: [
    { key: "name", label: "Partenaire SARL", required: true },
    { key: "email", label: "contact@partenaire.lu" },
    { key: "phone", label: "+352 000 000" },
    { key: "street", label: "12 Rue de la Gare" },
    { key: "postcode", label: "L-1234" },
    { key: "city", label: "Luxembourg" },
    { key: "country", label: "LU" },
    { key: "contact_first_name", label: "Jean" },
    { key: "contact_last_name", label: "Dupont" },
    { key: "contact_email", label: "jean@partenaire.lu" },
    { key: "contact_phone", label: "+352 691 000" },
    { key: "notes", label: "Notes diverses" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["name"], description: "nom" },
    ],
    updateOnDuplicate: true,
  },
  extraPayload: { is_active: true },
};

// ============================================================
// Games
// ============================================================

export const gamesImportConfig: CsvImportConfig = {
  entityName: "Games",
  table: "games",
  columns: [
    { key: "name", label: "Jeux Olympiques Paris 2024", required: true },
    { key: "short_name", label: "JO2024" },
    { key: "game_type", label: "jo_summer", required: true, transform: (v) => v.toLowerCase(), validateTypeGroup: "game_types" },
    { key: "edition_year", label: "2024", required: true, transform: (v) => parseInt(v, 10) || null },
    { key: "host_country", label: "France" },
    { key: "host_city", label: "Paris" },
    { key: "organizer", label: "CIO" },
    { key: "preparation_start", label: "2021-01-01", transform: normalizeDate },
    { key: "competition_start", label: "2024-07-26", required: true, transform: normalizeDate },
    { key: "competition_end", label: "2024-08-11", required: true, transform: normalizeDate },
    { key: "closing_date", label: "2024-08-11", transform: normalizeDate },
    { key: "status", label: "preparation", default: "preparation", transform: (v) => v.toLowerCase() },
    { key: "description", label: "Description de l'événement" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["name"], description: "nom" },
    ],
    updateOnDuplicate: true,
  },
};

// ============================================================
// Federation Members
// ============================================================

export const federationMembersImportConfig: CsvImportConfig = {
  entityName: "Membre de fédération",
  table: "federation_members",
  columns: [
    { key: "first_name", label: "Jean", required: true },
    { key: "last_name", label: "Dupont", required: true },
    { key: "federation_acronym", label: "FLA", required: true, aliases: ["federation"], linkOnly: true },
    { key: "federation_name", label: "Fédération Luxembourgeoise d'Athlétisme", required: true, linkOnly: true },
    { key: "role", label: "president", required: true, aliases: ["fonction"], validateTypeGroup: "federation_member_roles" },
    { key: "email", label: "jean.dupont@fla.lu" },
    { key: "phone", label: "+352 691 000 000" },
    { key: "start_date", label: "2024-01-01", transform: normalizeDate },
    { key: "end_date", label: "2028-12-31", transform: normalizeDate },
    { key: "notes", label: "Notes" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["federation_id", "first_name", "last_name"], description: "fédération + nom" },
      { keys: ["federation_id", "email"], description: "fédération + email" },
    ],
    updateOnDuplicate: true,
  },
  links: [
    {
      csvColumn: "federation_acronym",
      table: "federations",
      matchColumn: "acronym",
      selectColumns: "id,acronym",
      createIfMissing: false,
      targetColumn: "federation_id",
    },
    {
      csvColumn: "federation_name",
      table: "federations",
      matchColumn: "name",
      selectColumns: "id,name",
      createIfMissing: false,
      targetColumn: "federation_id",
    },
  ],
  extraPayload: { is_active: true },
};

// ============================================================
// Club Members
// ============================================================

export const clubMembersImportConfig: CsvImportConfig = {
  entityName: "Membre de club",
  table: "club_members",
  columns: [
    { key: "first_name", label: "Jean", required: true },
    { key: "last_name", label: "Dupont", required: true },
    { key: "club_name", label: "FC Luxembourg", required: true, aliases: ["club"], linkOnly: true },
    { key: "role", label: "president", required: true, aliases: ["fonction"], validateTypeGroup: "club_member_roles" },
    { key: "email", label: "jean.dupont@club.lu" },
    { key: "phone", label: "+352 691 000 000" },
    { key: "start_date", label: "2024-01-01", transform: normalizeDate },
    { key: "end_date", label: "2028-12-31", transform: normalizeDate },
    { key: "notes", label: "Notes" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["club_id", "first_name", "last_name"], description: "club + nom" },
      { keys: ["club_id", "email"], description: "club + email" },
    ],
    updateOnDuplicate: true,
  },
  links: [
    {
      csvColumn: "club_name",
      table: "clubs",
      matchColumn: "name",
      selectColumns: "id,name",
      createIfMissing: false,
      targetColumn: "club_id",
    },
  ],
  extraPayload: { is_active: true },
};

// ============================================================
// Coaches (Encadrants)
// ============================================================

export const coachesImportConfig: CsvImportConfig = {
  entityName: "Encadrant",
  table: "coaches",
  columns: [
    { key: "first_name", label: "Jean", required: true },
    { key: "last_name", label: "Dupont", required: true },
    { key: "federation_acronym", label: "FLA", required: true, aliases: ["federation"], linkOnly: true },
    { key: "federation_name", label: "Fédération Luxembourgeoise d'Athlétisme", required: true, linkOnly: true },
    { key: "club_name", label: "FC Luxembourg", required: true, aliases: ["club"], linkOnly: true },
    { key: "role", label: "coach", required: true, aliases: ["fonction"], validateTypeGroup: "coach_roles" },
    { key: "email", label: "jean.dupont@email.lu" },
    { key: "phone", label: "+352 691 000 000" },
  ],
  duplicateCheck: {
    checks: [
      { keys: ["federation_id", "club_id", "first_name", "last_name"], description: "fédération + club + nom" },
      { keys: ["federation_id", "club_id", "email"], description: "fédération + club + email" },
    ],
    updateOnDuplicate: true,
  },
  links: [
    {
      csvColumn: "federation_acronym",
      table: "federations",
      matchColumn: "acronym",
      selectColumns: "id,acronym",
      createIfMissing: false,
      targetColumn: "federation_id",
    },
    {
      csvColumn: "federation_name",
      table: "federations",
      matchColumn: "name",
      selectColumns: "id,name",
      createIfMissing: false,
      targetColumn: "federation_id",
    },
    {
      csvColumn: "club_name",
      table: "clubs",
      matchColumn: "name",
      selectColumns: "id,name",
      createIfMissing: false,
      targetColumn: "club_id",
    },
  ],
  extraPayload: { is_active: true },
};