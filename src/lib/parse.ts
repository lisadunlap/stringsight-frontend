import Papa from "papaparse";

export type ParsedData = { rows: Record<string, any>[]; columns: string[] };

/**
 * Parse JSON Lines (JSONL) text into an array of objects with clear diagnostics.
 * Inputs:
 *  - text: string containing file contents separated by "\n" or "\r\n"
 *  - fileName: optional file name used only for error messages
 * Output:
 *  - Array<Record<string, any>> where each element is a parsed JSON object from a non-empty line
 */
export function parseJsonlText(text: string, fileName?: string): Record<string, any>[] {
  const lines = text.split(/\r?\n/);
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch (e: any) {
      const lineNo = i + 1;
      const preview = trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
      const baseMsg = e?.message || "Invalid JSON";
      const where = fileName ? ` in ${fileName}` : "";
      const hint = "Ensure strings use double quotes (\") and newlines are escaped as \\n.";
      throw new Error(`Failed to parse JSONL${where} at line ${lineNo}: ${baseMsg}\nPreview: ${preview}\nHint: ${hint}`);
    }
  }
  return rows;
}

/**
 * Parse a File into rows and inferred columns.
 * Inputs:
 *  - file: File whose name determines format (.jsonl | .json | .csv)
 * Output:
 *  - { rows, columns }: rows as array of objects; columns inferred from up to first 100 rows
 */
export async function parseFile(file: File): Promise<ParsedData> {
  const name = file.name.toLowerCase();
  const text = await file.text();
  if (name.endsWith(".jsonl")) {
    const rows = parseJsonlText(text, file.name);
    return { rows, columns: inferColumns(rows) };
  }
  if (name.endsWith(".json")) {
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : [data];
    return { rows, columns: inferColumns(rows) };
  }
  if (name.endsWith(".csv")) {
    const res = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
    const rows = res.data as Record<string, any>[];
    return { rows, columns: inferColumns(rows) };
  }
  throw new Error("Unsupported file type. Use JSONL, JSON, or CSV.");
}

/**
 * Infer column names from sample rows.
 * Inputs:
 *  - rows: Array<Record<string, any>>
 * Output:
 *  - string[] of unique keys appearing in up to the first 100 rows
 */
export function inferColumns(rows: Record<string, any>[]): string[] {
  const cols = new Set<string>();
  for (const r of rows.slice(0, 100)) {
    Object.keys(r || {}).forEach((k) => cols.add(k));
  }
  return Array.from(cols);
}


