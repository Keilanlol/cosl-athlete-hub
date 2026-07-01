import { supabase } from "@/lib/supabase";

// ============================================================
// Types
// ============================================================

export type CsvColumn = {
  key: string;
  aliases?: string[];
  label: string;
  required?: boolean;
  default?: unknown;
  transform?: (raw: string) => unknown;
  linkOnly?: boolean;
  autoGenerate?: boolean;
};

export type DuplicateCheck = {
  checks: { keys: string[]; description: string }[];
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

export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
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

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? "").trim(); });
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
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) {
      result.push(current); current = "";
    } else { current += char; }
  }
  result.push(current);
  return result;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, "_");
}

export type ColumnMatch = { csvHeader: string | null; found: boolean };

export function matchColumns(csvHeaders: string[], columns: CsvColumn[]): Record<string, ColumnMatch> {
  const normalizedKeys = new Map(csvHeaders.map((h) => [normalizeHeader(h), h]));
  const result: Record<string, ColumnMatch> = {};
  for (const col of columns) {
    const candidates = [col.key, ...(col.aliases ?? [])];
    let matched: string | null = null;
    for (const c of candidates) {
      const nk = normalizeHeader(c);
      const actualKey = normalizedKeys.get(nk);
      if (actualKey) { matched = actualKey; break; }
    }
    result[col.key] = { csvHeader: matched, found: !!matched };
  }
  return result;
}

function findValue(row: Record<string, string>, column: CsvColumn): string | undefined {
  const normalizedKeys = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
  const candidates = [column.key, ...(column.aliases ?? [])];
  for (const c of candidates) {
    const nk = normalizeHeader(c);
    const actualKey = normalizedKeys.get(nk);
    if (actualKey && row[actualKey]) return row[actualKey];
  }
  return undefined;
}

// ============================================================
// Import types
// ============================================================

export type ImportAction = {
  id: number;
  type: "create" | "update";
  row: Record<string, string>;
  payload: Record<string, unknown>;
  existingId?: string | null;
  matchReason?: string;
  label: string;
};

export type ImportResult = {
  actions: ImportAction[];
  skipped: { row: Record<string, string>; reason: string }[];
  errors: { row: Record<string, string>; reason: string }[];
  inserted: number;
  updated: number;
};

// Shared state between preview and confirm
type ImportContext = {
  config: CsvImportConfig;
  checkMaps: Map<string, string>[];
  linkCache: Record<string, Map<string, string>>;
};

/**
 * Phase 1: Dry-run preview.
 * Computes all create/update actions without writing to the database.
 */
export async function previewImport(
  config: CsvImportConfig,
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const actions: ImportAction[] = [];
  const skipped: { row: Record<string, string>; reason: string }[] = [];
  const errors: { row: Record<string, string>; reason: string }[] = [];

  // Pre-load existing entities
  const allCheckKeys = new Set<string>();
  config.duplicateCheck.checks.forEach((c) => c.keys.forEach((k) => allCheckKeys.add(k)));
  const { data: existing } = await supabase
    .from(config.table)
    .select([...allCheckKeys, "id"].join(","));

  const checkMaps: Map<string, string>[] = config.duplicateCheck.checks.map((check) => {
    const map = new Map<string, string>();
    ((existing ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
      const key = check.keys.map((k) => {
        const v = row[k];
        return v != null ? String(v).toLowerCase().trim() : "";
      }).join("|");
      if (key && !key.includes("||") && !key.startsWith("|") && !key.endsWith("|")) {
        const id = row.id as string;
        if (id) map.set(key, id);
      }
    });
    return map;
  });

  // Pre-load linked entities
  const linkCache: Record<string, Map<string, string>> = {};
  if (config.links) {
    for (const link of config.links) {
      const { data } = await supabase.from(link.table).select(link.selectColumns);
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

  const generatedValues: string[] = [];
  const batchSeen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const payload: Record<string, unknown> = { ...config.extraPayload };

    // Build payload
    for (const col of config.columns) {
      if (col.autoGenerate) continue;
      const raw = findValue(row, col);
      if (raw === undefined || raw === "") {
        if (col.default !== undefined && !col.linkOnly) payload[col.key] = col.default;
        continue;
      }
      if (!col.linkOnly) {
        payload[col.key] = col.transform ? col.transform(raw) : raw;
      }
    }

    // Resolve links
    if (config.links) {
      for (const link of config.links) {
        const raw = findValue(row, { key: link.csvColumn, label: link.csvColumn });
        if (!raw) continue;
        let linkId = linkCache[link.csvColumn]?.get(raw.toLowerCase());
        if (!linkId && link.createIfMissing && link.createColumns) {
          // Note: we don't create linked entities during preview, only during confirm.
          // For preview, if the entity doesn't exist, we just skip the link.
        }
        if (linkId) payload[link.targetColumn] = linkId;
      }
    }

    // Cascading duplicate check
    let existingId: string | null = null;
    let matchedDescription = "";

    for (let s = 0; s < config.duplicateCheck.checks.length; s++) {
      const check = config.duplicateCheck.checks[s];
      const allKeysPresent = check.keys.every((k) => payload[k] != null && payload[k] !== "");
      if (!allKeysPresent) continue;
      const key = check.keys.map((k) => String(payload[k]).toLowerCase().trim()).join("|");
      const found = checkMaps[s].get(key);
      if (found) { existingId = found; matchedDescription = check.description; break; }
      if (batchSeen.has(`${s}:${key}`)) {
        existingId = "__batch_duplicate__";
        matchedDescription = `${check.description} (dupliqué dans le fichier)`;
        break;
      }
    }

    if (existingId === "__batch_duplicate__") {
      const desc = config.duplicateCheck.checks
        .flatMap((c) => c.keys.map((k) => payload[k]))
        .filter(Boolean).join(" / ");
      skipped.push({ row, reason: `Doublon (${matchedDescription}) — ${desc}` });
      continue;
    }

    // Build label for display
    const labelCols = config.duplicateCheck.checks[0].keys;
    const label = labelCols.map((k) => payload[k]).filter(Boolean).join(" / ")
      || Object.values(row).slice(0, 3).filter(Boolean).join(" ");

    if (existingId) {
      if (config.duplicateCheck.updateOnDuplicate) {
        actions.push({
          id: i, type: "update", row, payload, existingId,
          matchReason: matchedDescription, label,
        });
      } else {
        skipped.push({ row, reason: `Doublon (${matchedDescription}) — ${label}` });
        continue;
      }
    } else {
      // Generate auto fields for new records
      if (config.generateColumn) {
        for (const col of config.columns) {
          if (!col.autoGenerate) continue;
          if (payload[col.key]) continue;
          const gen = await config.generateColumn(col.key, generatedValues);
          if (gen) { generatedValues.push(gen); payload[col.key] = gen; }
        }
      }
      actions.push({ id: i, type: "create", row, payload, label });
    }

    // Mark as seen in batch
    for (let s = 0; s < config.duplicateCheck.checks.length; s++) {
      const check = config.duplicateCheck.checks[s];
      const allKeysPresent = check.keys.every((k) => payload[k] != null && payload[k] !== "");
      if (!allKeysPresent) continue;
      const key = check.keys.map((k) => String(payload[k]).toLowerCase().trim()).join("|");
      batchSeen.add(`${s}:${key}`);
    }
  }

  return { actions, skipped, errors, inserted: 0, updated: 0 };
}

/**
 * Phase 2: Confirm import.
 * Executes only the selected actions (create + update).
 */
export async function confirmImport(
  config: CsvImportConfig,
  actions: ImportAction[],
  selectedIds: Set<number>,
  onProgress?: (current: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { actions: [], skipped: [], errors: [], inserted: 0, updated: 0 };
  const selected = actions.filter((a) => selectedIds.has(a.id));

  // Pre-load linked entities again (in case some were created in preview)
  const linkCache: Record<string, Map<string, string>> = {};
  if (config.links) {
    for (const link of config.links) {
      const { data } = await supabase.from(link.table).select(link.selectColumns);
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

  for (let i = 0; i < selected.length; i++) {
    const action = selected[i];
    onProgress?.(i + 1, selected.length);

    // Re-resolve links (create missing linked entities if needed)
    if (config.links) {
      for (const link of config.links) {
        const raw = findValue(action.row, { key: link.csvColumn, label: link.csvColumn });
        if (!raw) continue;
        let linkId = linkCache[link.csvColumn]?.get(raw.toLowerCase());
        if (!linkId && link.createIfMissing && link.createColumns) {
          const insertData = link.createColumns(raw);
          const { data: created, error } = await supabase
            .from(link.table).insert(insertData).select("id").single();
          if (!error && created) {
            linkId = created.id as string;
            linkCache[link.csvColumn].set(raw.toLowerCase(), linkId);
          }
        }
        if (linkId) action.payload[link.targetColumn] = linkId;
      }
    }

    if (action.type === "update" && action.existingId) {
      const { error } = await supabase
        .from(config.table).update(action.payload).eq("id", action.existingId);
      if (error) { result.errors.push({ row: action.row, reason: error.message }); continue; }
      result.updated++;
    } else {
      const { error } = await supabase.from(config.table).insert(action.payload);
      if (error) { result.errors.push({ row: action.row, reason: error.message }); continue; }
      result.inserted++;
    }
  }

  return result;
}