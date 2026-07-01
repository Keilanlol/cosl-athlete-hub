import { supabase } from "@/lib/supabase";

// ============================================================
// Types
// ============================================================

export type CsvColumn = {
  /** Column key in the CSV header (case-insensitive matching) */
  key: string;
  /** Alternative accepted header names */
  aliases?: string[];
  /** Human-readable label for preview/template */
  label: string;
  /** Whether this field is required to proceed */
  required?: boolean;
  /** Default value if column is missing/empty */
  default?: unknown;
  /** Transform the raw CSV string value before insertion */
  transform?: (raw: string) => unknown;
  /** If true, the column is used for link resolution only and NOT inserted into the payload */
  linkOnly?: boolean;
};

export type DuplicateCheck = {
  /** Column keys to check for duplicates */
  keys: string[];
  /** Description for the report (e.g. "COSL ID ou email") */
  description: string;
};

export type LinkResolver = {
  /** Column key in the CSV that contains the linked entity's name/identifier */
  csvColumn: string;
  /** Table to search in */
  table: string;
  /** Column in the target table to match against */
  matchColumn: string;
  /** Columns to select from the target table (must include id) */
  selectColumns: string;
  /** Whether to create the entity if not found */
  createIfMissing: boolean;
  /** Columns to set when creating the linked entity */
  createColumns?: (value: string) => Record<string, unknown>;
  /** Column key in the payload to set with the resolved id */
  targetColumn: string;
};

export type CsvImportConfig = {
  /** Entity name (for display) */
  entityName: string;
  /** Supabase table to insert into */
  table: string;
  /** CSV columns definition */
  columns: CsvColumn[];
  /** How to check for duplicates */
  duplicateCheck: DuplicateCheck;
  /** Linked entity resolvers (clubs, federations, sports...) */
  links?: LinkResolver[];
  /** Extra payload fields to add to every row (e.g. is_active: true) */
  extraPayload?: Record<string, unknown>;
  /** Function to generate a value for a column if missing (e.g. cosl_id) */
  generateColumn?: (
    column: string,
    existingValues: string[],
  ) => Promise<string | null> | string | null;
};

// ============================================================
// Helpers
// ============================================================

/**
 * Normalizes a date string from various common formats to ISO (YYYY-MM-DD).
 * Accepts: 2024-01-15, 15/01/2024, 01/15/2024, 15-01-2024, 15.01.2024, 2024/01/15
 * For ambiguous DD/MM vs MM/DD (both ≤ 12), defaults to DD/MM (European/French).
 * Returns null if the input cannot be parsed.
 */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Already ISO: 2024-01-15 or 2024/01/15
  const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or MM/DD/YYYY (with / or - or .)
  const partsMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (partsMatch) {
    let [, p1, p2, y] = partsMatch;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);

    let day: number, month: number;
    // If first > 12, it must be DD/MM
    if (n1 > 12) {
      day = n1; month = n2;
    }
    // If second > 12, it must be MM/DD
    else if (n2 > 12) {
      month = n1; day = n2;
    }
    // Both ≤ 12: ambiguous, default to European DD/MM
    else {
      day = n1; month = n2;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/** Parse CSV text into array of objects, handling quoted fields, semicolons and commas */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] ?? "").trim();
    });
    return obj;
  });
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/** Normalize a CSV header for matching (lowercase, trim, remove spaces/accents) */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_");
}

export type ColumnMatch = {
  csvHeader: string | null;
  found: boolean;
};

/** Check which CSV headers match the expected columns */
export function matchColumns(
  csvHeaders: string[],
  columns: CsvColumn[],
): Record<string, ColumnMatch> {
  const normalizedKeys = new Map(
    csvHeaders.map((h) => [normalizeHeader(h), h]),
  );
  const result: Record<string, ColumnMatch> = {};
  for (const col of columns) {
    const candidates = [col.key, ...(col.aliases ?? [])];
    let matched: string | null = null;
    for (const c of candidates) {
      const nk = normalizeHeader(c);
      const actualKey = normalizedKeys.get(nk);
      if (actualKey) {
        matched = actualKey;
        break;
      }
    }
    result[col.key] = { csvHeader: matched, found: !!matched };
  }
  return result;
}

/** Find a value in a CSV row by trying the column key and its aliases */
function findValue(
  row: Record<string, string>,
  column: CsvColumn,
): string | undefined {
  const normalizedKeys = new Map(
    Object.keys(row).map((k) => [normalizeHeader(k), k]),
  );
  const candidates = [column.key, ...(column.aliases ?? [])];
  for (const c of candidates) {
    const nk = normalizeHeader(c);
    const actualKey = normalizedKeys.get(nk);
    if (actualKey && row[actualKey]) return row[actualKey];
  }
  return undefined;
}

export type ImportResult = {
  inserted: number;
  skipped: { row: Record<string, string>; reason: string }[];
  errors: { row: Record<string, string>; reason: string }[];
};

/**
 * Runs the full import process.
 * @param config The entity-specific config
 * @param rows Parsed CSV rows
 * @param onProgress Callback for progress updates
 */
export async function runImport(
  config: CsvImportConfig,
  rows: Record<string, string>[],
  onProgress?: (current: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, skipped: [], errors: [] };

  // Pre-load existing entities for duplicate check
  const { data: existing } = await supabase
    .from(config.table)
    .select(config.duplicateCheck.keys.join(","));

  const existingValues = new Map<string, Set<string>>();
  for (const key of config.duplicateCheck.keys) {
    existingValues.set(key, new Set());
  }
  ((existing ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
    for (const key of config.duplicateCheck.keys) {
      const val = row[key];
      if (val && typeof val === "string") {
        existingValues.get(key)!.add(val.toLowerCase());
      }
    }
  });

  // Pre-load linked entities
  const linkCache: Record<string, Map<string, string>> = {};
  if (config.links) {
    for (const link of config.links) {
      const { data } = await supabase
        .from(link.table)
        .select(link.selectColumns);
      const cache = new Map<string, string>();
      ((data ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
        const name = row[link.matchColumn];
        const id = row.id;
        if (name && typeof name === "string" && id && typeof id === "string") {
          cache.set(name.toLowerCase(), id);
        }
      });
      linkCache[link.csvColumn] = cache;
    }
  }

  // Track generated values (e.g. cosl_id sequences)
  const generatedValues: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.(i + 1, rows.length);

    // Build payload
    const payload: Record<string, unknown> = { ...config.extraPayload };

    let hasError = false;
    let errorReason = "";

    // Process columns
    for (const col of config.columns) {
      let raw = findValue(row, col);

      if (raw === undefined || raw === "") {
        if (col.required) {
          // Try generateColumn
          if (config.generateColumn) {
            const gen = await config.generateColumn(col.key, generatedValues);
            if (gen) {
              generatedValues.push(gen);
              if (!col.linkOnly) payload[col.key] = gen;
              continue;
            }
          }
          hasError = true;
          errorReason = `Champ requis manquant : ${col.label}`;
          break;
        }
        if (col.default !== undefined && !col.linkOnly) {
          payload[col.key] = col.default;
        }
        continue;
      }

      // Transform and add to payload (unless linkOnly)
      if (!col.linkOnly) {
        payload[col.key] = col.transform ? col.transform(raw) : raw;
      }
    }

    if (hasError) {
      result.errors.push({ row, reason: errorReason });
      continue;
    }

    // Check duplicates
    let isDuplicate = false;
    let dupReason = "";
    for (const key of config.duplicateCheck.keys) {
      const val = payload[key];
      if (val && typeof val === "string") {
        if (existingValues.get(key)!.has(val.toLowerCase())) {
          isDuplicate = true;
          dupReason = `${key} déjà existant : ${val}`;
          break;
        }
        // Also check against generated values in this batch
        if (generatedValues.includes(val)) {
          isDuplicate = true;
          dupReason = `${key} dupliqué dans le fichier : ${val}`;
          break;
        }
      }
    }

    if (isDuplicate) {
      // Build a readable description
      const desc = config.duplicateCheck.keys
        .map((k) => payload[k])
        .filter(Boolean)
        .join(" / ");
      result.skipped.push({
        row,
        reason: `Doublon (${config.duplicateCheck.description}) — ${desc}`,
      });
      // Add to existing to prevent further duplicates in same batch
      for (const key of config.duplicateCheck.keys) {
        const val = payload[key];
        if (val && typeof val === "string") {
          existingValues.get(key)!.add(val.toLowerCase());
        }
      }
      continue;
    }

    // Resolve links
    if (config.links) {
      for (const link of config.links) {
        const raw = findValue(row, {
          key: link.csvColumn,
          label: link.csvColumn,
        });
        if (!raw) continue;

        let linkId = linkCache[link.csvColumn]?.get(raw.toLowerCase());

        if (!linkId && link.createIfMissing && link.createColumns) {
          const insertData = link.createColumns(raw);
          const { data: created, error } = await supabase
            .from(link.table)
            .insert(insertData)
            .select("id")
            .single();
          if (!error && created) {
            linkId = created.id as string;
            linkCache[link.csvColumn].set(raw.toLowerCase(), linkId);
          }
        }

        if (linkId) {
          payload[link.targetColumn] = linkId;
        }
      }
    }

    // Insert
    const { error } = await supabase.from(config.table).insert(payload);
    if (error) {
      result.errors.push({ row, reason: error.message });
      continue;
    }

    result.inserted++;
    // Add to existing to prevent duplicates in same batch
    for (const key of config.duplicateCheck.keys) {
      const val = payload[key];
      if (val && typeof val === "string") {
        existingValues.get(key)!.add(val.toLowerCase());
      }
    }
  }

  return result;
}