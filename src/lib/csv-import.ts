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
  /** Whether this field is expected (shown in UI, but does not block import) */
  required?: boolean;
  /** Default value if column is missing/empty */
  default?: unknown;
  /** Transform the raw CSV string value before insertion */
  transform?: (raw: string) => unknown;
  /** If true, the column is used for link resolution only and NOT inserted into the payload */
  linkOnly?: boolean;
  /** If true, this field is auto-generated for new records (using generateColumn) */
  autoGenerate?: boolean;
};

export type DuplicateCheck = {
  /** Cascading check strategies, tried in order. First match wins. */
  checks: { keys: string[]; description: string }[];
  /** Whether to update existing records instead of skipping */
  updateOnDuplicate?: boolean;
};

export type LinkResolver = {
  csvColumn: string;
  table: string;
  matchColumn: string;
  selectColumns: string;
  createIfMissing: boolean;
  createColumns?: (value: string) => Record<string, unknown>;
  targetColumn: string;
};

export type CsvImportConfig = {
  entityName: string;
  table: string;
  columns: CsvColumn[];
  duplicateCheck: DuplicateCheck;
  links?: LinkResolver[];
  extraPayload?: Record<string, unknown>;
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
    if (n1 > 12) { day = n1; month = n2; }
    else if (n2 > 12) { month = n1; day = n2; }
    else { day = n1; month = n2; }

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
  updated: number;
  skipped: { row: Record<string, string>; reason: string }[];
  errors: { row: Record<string, string>; reason: string }[];
};

/**
 * Runs the full import process with cascading duplicate checks and upsert.
 */
export async function runImport(
  config: CsvImportConfig,
  rows: Record<string, string>[],
  onProgress?: (current: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, updated: 0, skipped: [], errors: [] };

  // Pre-load existing entities for each duplicate check strategy
  const allCheckKeys = new Set<string>();
  config.duplicateCheck.checks.forEach((c) => c.keys.forEach((k) => allCheckKeys.add(k)));

  const { data: existing } = await supabase
    .from(config.table)
    .select([...allCheckKeys, "id"].join(","));

  // Build lookup maps for each check strategy: "key1|key2" → record id
  const checkMaps: Map<string, string>[] = config.duplicateCheck.checks.map((check) => {
    const map = new Map<string, string>();
    ((existing ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
      const key = check.keys
        .map((k) => {
          const v = row[k];
          return v != null ? String(v).toLowerCase().trim() : "";
        })
        .join("|");
      // Only add if all keys have values
      if (key && !key.includes("||") && !key.startsWith("|") && !key.endsWith("|")) {
        const id = row.id as string;
        if (id) map.set(key, id);
      }
    });
    return map;
  });

  // Track generated values in this batch
  const generatedValues: string[] = [];
  // Track inserted/updated keys to prevent duplicates within the same batch
  const batchSeen = new Set<string>();

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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.(i + 1, rows.length);

    // Build payload
    const payload: Record<string, unknown> = { ...config.extraPayload };

    // Process columns — no errors on missing fields, just leave them out
    for (const col of config.columns) {
      // Skip autoGenerate fields — they'll be handled later for new records
      if (col.autoGenerate) continue;

      const raw = findValue(row, col);

      if (raw === undefined || raw === "") {
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

    // Cascading duplicate check
    let existingId: string | null = null;
    let matchedDescription = "";

    for (let s = 0; s < config.duplicateCheck.checks.length; s++) {
      const check = config.duplicateCheck.checks[s];
      // Check if all keys have non-empty values in payload
      const allKeysPresent = check.keys.every((k) => {
        const v = payload[k];
        return v != null && v !== "";
      });
      if (!allKeysPresent) continue;

      const key = check.keys
        .map((k) => String(payload[k]).toLowerCase().trim())
        .join("|");

      // Check in existing map
      const found = checkMaps[s].get(key);
      if (found) {
        existingId = found;
        matchedDescription = check.description;
        break;
      }

      // Check in batch (prevent duplicates within same CSV)
      if (batchSeen.has(`${s}:${key}`)) {
        existingId = "__batch_duplicate__";
        matchedDescription = `${check.description} (dupliqué dans le fichier)`;
        break;
      }
    }

    if (existingId === "__batch_duplicate__") {
      const desc = config.duplicateCheck.checks
        .flatMap((c) => c.keys.map((k) => payload[k]))
        .filter(Boolean)
        .join(" / ");
      result.skipped.push({
        row,
        reason: `Doublon (${matchedDescription}) — ${desc}`,
      });
      continue;
    }

    if (existingId) {
      // Found an existing record
      if (config.duplicateCheck.updateOnDuplicate) {
        // Update the existing record
        const { error } = await supabase
          .from(config.table)
          .update(payload)
          .eq("id", existingId);
        if (error) {
          result.errors.push({ row, reason: error.message });
          continue;
        }
        result.updated++;
      } else {
        // Skip
        const desc = config.duplicateCheck.checks
          .flatMap((c) => c.keys.map((k) => payload[k]))
          .filter(Boolean)
          .join(" / ");
        result.skipped.push({
          row,
          reason: `Doublon (${matchedDescription}) — ${desc}`,
        });
        continue;
      }
    } else {
      // New record — generate auto fields
      if (config.generateColumn) {
        for (const col of config.columns) {
          if (!col.autoGenerate) continue;
          if (payload[col.key]) continue; // Already has a value
          const gen = await config.generateColumn(col.key, generatedValues);
          if (gen) {
            generatedValues.push(gen);
            payload[col.key] = gen;
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
    }

    // Mark as seen in batch for all check strategies
    for (let s = 0; s < config.duplicateCheck.checks.length; s++) {
      const check = config.duplicateCheck.checks[s];
      const allKeysPresent = check.keys.every((k) => {
        const v = payload[k];
        return v != null && v !== "";
      });
      if (!allKeysPresent) continue;
      const key = check.keys
        .map((k) => String(payload[k]).toLowerCase().trim())
        .join("|");
      batchSeen.add(`${s}:${key}`);
    }
  }

  return result;
}