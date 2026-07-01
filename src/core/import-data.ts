/**
 * File import — open a file picker and parse a .csv / .tsv / .xlsx into a dense
 * 2-D grid of cell values (strings, with numeric-looking text coerced to
 * numbers so formulas keep working). The caller decides what to do with the
 * grid (write into the sheet, or hand it to a host `onImport` callback).
 */

/** Coerce a raw text token to a number when it looks numeric, else keep text. */
function coerce(token: string): string | number {
  const t = token.trim();
  if (t === "") return "";
  // Strip currency/grouping for the numeric test, but only coerce plain numbers.
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return token;
}

/** Parse delimited text (CSV/TSV) into rows, honoring quoted CSV fields. */
function parseDelimited(text: string, delim: string): (string | number)[][] {
  const rows: (string | number)[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row.map(coerce));
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      /* ignore — handled by the following \n */
    } else field += ch;
  }
  if (field !== "" || row.length) pushRow();
  return rows;
}

/** Parse a picked file into a value grid. Supports .csv, .tsv, .xlsx. */
export async function parseFileToGrid(file: File): Promise<(string | number)[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    const grid: (string | number)[][] = [];
    ws?.eachRow({ includeEmpty: true }, (xrow) => {
      const arr: (string | number)[] = [];
      const last = xrow.cellCount || 0;
      for (let c = 1; c <= last; c++) {
        const v = xrow.getCell(c).value;
        if (v == null) arr.push("");
        else if (typeof v === "number") arr.push(v);
        else if (typeof v === "object" && v && "result" in v) arr.push((v as { result?: unknown }).result as string | number ?? "");
        else if (typeof v === "object" && v && "text" in v) arr.push(String((v as { text?: unknown }).text ?? ""));
        else arr.push(String(v));
      }
      grid.push(arr);
    });
    return grid;
  }
  const text = await file.text();
  return parseDelimited(text, name.endsWith(".tsv") ? "\t" : ",");
}

/** Open the OS file picker; resolves with the chosen file (or null if cancelled). */
export function pickFile(accept = ".csv,.tsv,.xlsx"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

/** Pick a file and return its parsed grid (null if cancelled / unparseable). */
export async function pickAndParse(accept?: string): Promise<(string | number)[][] | null> {
  const file = await pickFile(accept);
  if (!file) return null;
  try {
    return await parseFileToGrid(file);
  } catch {
    return null;
  }
}

/* ---- "Create new spreadsheet" handoff -----------------------------------
   "Create new spreadsheet" opens the same app URL in a NEW browser tab. We
   stash the parsed grid here so that fresh page can pick it up and render it as
   its initial data (instead of the default dataset). */
const IMPORT_PAYLOAD_KEY = "levich:import-payload";

/** Stash an imported grid for a new tab to consume on load. */
export function stashImportPayload(grid: (string | number)[][]): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(IMPORT_PAYLOAD_KEY, JSON.stringify(grid));
  } catch {
    /* ignore */
  }
}

/** Read & clear a stashed import payload (used by the host page on load). */
export function takeImportPayload(): (string | number)[][] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(IMPORT_PAYLOAD_KEY);
    if (!raw) return null;
    localStorage.removeItem(IMPORT_PAYLOAD_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as (string | number)[][]) : null;
  } catch {
    return null;
  }
}

/* ---- Rich snapshot handoff (xlsx-to-snapshot) ----------------------------
   For .xlsx imports we carry a full Univer IWorkbookData snapshot (styles /
   merges / formats / multiple sheets) rather than a flat grid. Stashed for a
   new tab / reload to pick up and render with full fidelity. */
const SNAPSHOT_PAYLOAD_KEY = "levich:import-snapshot";

/** Stash a rich workbook snapshot for a new tab / reload to consume on load. */
export function stashSnapshotPayload(snapshot: unknown): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(SNAPSHOT_PAYLOAD_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    // e.g. QuotaExceeded for a very large workbook — caller can fall back.
    return false;
  }
}

/** Read & clear a stashed rich snapshot (used by the host page on load). */
export function takeSnapshotPayload<T = unknown>(): T | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(SNAPSHOT_PAYLOAD_KEY);
    if (!raw) return null;
    localStorage.removeItem(SNAPSHOT_PAYLOAD_KEY);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
