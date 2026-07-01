/**
 * Lightweight text exporters (CSV / TSV / HTML) that read the LIVE Univer
 * snapshot — the same source as the .xlsx exporter — and trigger a browser
 * download. Numbers are rendered with their cell's number-format pattern
 * ($currency, %percent) so the file matches what's on screen.
 */
import type { SnapshotSource, WorkbookSnapshot } from "./export-xlsx";

type SnapStyle = { n?: { pattern?: string } } | undefined;
type SnapCell = { v?: string | number | boolean | null; f?: string; s?: string | SnapStyle } | undefined;

function resolveStyle(s: SnapCell extends undefined ? never : NonNullable<SnapCell>["s"], styles?: WorkbookSnapshot["styles"]): SnapStyle {
  return (typeof s === "string" ? styles?.[s] : s) as SnapStyle;
}

/** Format one cell's value the way it appears on screen (currency/percent). */
function fmtValue(cell: SnapCell, styles?: WorkbookSnapshot["styles"]): string {
  if (!cell) return "";
  const v = cell.v;
  if (v === undefined || v === null) return "";
  const style = resolveStyle(cell.s, styles);
  const pattern = style?.n?.pattern;
  if (typeof v === "number" && pattern) {
    if (pattern.includes("$")) return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (pattern.includes("%")) return `${(v * 100).toFixed(2)}%`;
    return v.toLocaleString();
  }
  return String(v);
}

/** Extract the first sheet as a dense 2-D string grid (trailing blanks trimmed). */
function getGrid(source: SnapshotSource): string[][] {
  const snap = source.getSnapshot();
  const sheetId = snap.sheetOrder?.[0] ?? Object.keys(snap.sheets ?? {})[0];
  const cellData = (sheetId ? snap.sheets?.[sheetId]?.cellData : undefined) ?? {};
  const styles = snap.styles;
  let maxRow = -1;
  let maxCol = -1;
  for (const [r, cols] of Object.entries(cellData)) {
    maxRow = Math.max(maxRow, Number(r));
    for (const c of Object.keys(cols ?? {})) maxCol = Math.max(maxCol, Number(c));
  }
  const grid: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const rowCells = (cellData as Record<number, Record<number, SnapCell>>)[r] ?? {};
    const arr: string[] = [];
    for (let c = 0; c <= maxCol; c++) arr.push(fmtValue(rowCells[c], styles));
    grid.push(arr);
  }
  while (grid.length && grid[grid.length - 1].every((c) => c === "")) grid.pop();
  return grid;
}

function triggerDownload(content: string, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const csvField = (s: string): string => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Download the live sheet as CSV. */
export function downloadCsv(source: SnapshotSource, filename = "sheet.csv"): void {
  const grid = getGrid(source);
  triggerDownload(grid.map((row) => row.map(csvField).join(",")).join("\n"), "text/csv;charset=utf-8", filename);
}

/** Download the live sheet as TSV. */
export function downloadTsv(source: SnapshotSource, filename = "sheet.tsv"): void {
  const grid = getGrid(source);
  triggerDownload(grid.map((row) => row.map((c) => c.replace(/\t/g, " ")).join("\t")).join("\n"), "text/tab-separated-values;charset=utf-8", filename);
}

/** Download the live sheet as a simple HTML table. */
export function downloadHtml(source: SnapshotSource, filename = "sheet.html"): void {
  const grid = getGrid(source);
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
  const body = grid
    .map((row, i) => `<tr>${row.map((c) => (i === 0 ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:sans-serif;font-size:13px}th,td{border:1px solid #d0d5dd;padding:4px 8px;text-align:left}th{background:#f9fafb}</style></head><body><table>${body}</table></body></html>`;
  triggerDownload(html, "text/html;charset=utf-8", filename);
}
