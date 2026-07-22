/**
 * Full-fidelity .xlsx export (constitution Principle III).
 *
 * Reads the LIVE Univer snapshot (values + formula results + per-cell styles +
 * merges + column widths + frozen panes) and writes an .xlsx via ExcelJS, which
 * — unlike SheetJS Community — preserves fills, fonts, borders, and number
 * formats. The downloaded file looks exactly like the on-screen sheet.
 *
 * `buildExcelWorkbook` is a pure snapshot→ExcelJS mapping so it can be unit
 * tested without a running Univer instance (see tests/fidelity).
 */
import ExcelJS from "exceljs";

/* ---- Minimal structural views of the Univer snapshot we read -------------- */

interface SnapshotColor {
  rgb?: string;
}
interface SnapshotBorderSide {
  cl?: SnapshotColor;
}
interface SnapshotStyle {
  bl?: number; // bold (BooleanNumber)
  it?: number; // italic
  fs?: number; // font size
  ff?: string; // font family
  cl?: SnapshotColor; // text color
  bg?: SnapshotColor; // fill
  n?: { pattern?: string }; // number format
  ht?: number; // horizontal align (1 left, 2 center, 3 right)
  bd?: Record<string, SnapshotBorderSide | undefined>; // borders (t,b,l,r)
}
interface SnapshotCell {
  v?: string | number | boolean | null;
  f?: string; // formula (leading "=")
  s?: string | SnapshotStyle; // style id or inline style
}
interface SnapshotRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}
interface SnapshotSheet {
  name?: string;
  cellData?: Record<number, Record<number, SnapshotCell>>;
  columnData?: Record<number, { w?: number } | undefined>;
  mergeData?: SnapshotRange[];
  freeze?: { xSplit?: number; ySplit?: number };
}
export interface WorkbookSnapshot {
  sheetOrder?: string[];
  sheets?: Record<string, SnapshotSheet>;
  styles?: Record<string, SnapshotStyle | undefined>;
}

/** Anything exposing the live snapshot (Univer FWorkbook). */
export interface SnapshotSource {
  getSnapshot(): WorkbookSnapshot;
}

/* ---- Style mapping -------------------------------------------------------- */

function clampHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

export function toArgb(color?: string): string | undefined {
  if (!color) return undefined;
  const value = color.trim();

  // rgb()/rgba() — Univer/toolbar-applied colors can arrive in this form.
  const rgbMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgbMatch) {
    const [r, g, b] = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(Number);
    const a = rgbMatch[4] !== undefined ? Math.round(Number(rgbMatch[4]) * 255) : 255;
    return (clampHex(a) + clampHex(r) + clampHex(g) + clampHex(b)).toUpperCase();
  }

  // Hex (#rgb, #rrggbb, #aarrggbb).
  let hex = value.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length === 6) return ("FF" + hex).toUpperCase();
  if (hex.length === 8) return hex.toUpperCase();
  return undefined;
}

function hAlign(ht?: number): "left" | "center" | "right" | undefined {
  if (ht === 1) return "left";
  if (ht === 2) return "center";
  if (ht === 3) return "right";
  return undefined;
}

function resolveStyle(
  s: string | SnapshotStyle | undefined,
  styles?: Record<string, SnapshotStyle | undefined>,
): SnapshotStyle | undefined {
  if (!s) return undefined;
  return typeof s === "string" ? styles?.[s] : s;
}

function mapBorders(bd?: Record<string, SnapshotBorderSide | undefined>) {
  if (!bd) return undefined;
  const sides: Record<string, "top" | "bottom" | "left" | "right"> = {
    t: "top",
    b: "bottom",
    l: "left",
    r: "right",
  };
  const out: Record<string, { style: "thin"; color: { argb: string } }> = {};
  for (const [k, side] of Object.entries(bd)) {
    if (side && sides[k]) {
      out[sides[k]] = { style: "thin", color: { argb: toArgb(side.cl?.rgb) ?? "FF000000" } };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function applyStyle(cell: ExcelJS.Cell, style?: SnapshotStyle): void {
  if (!style) return;
  if (style.n?.pattern) cell.numFmt = style.n.pattern;

  const font: Partial<ExcelJS.Font> = {};
  if (style.bl === 1) font.bold = true;
  if (style.it === 1) font.italic = true;
  if (style.fs) font.size = style.fs;
  if (style.ff) font.name = style.ff;
  const textArgb = toArgb(style.cl?.rgb);
  if (textArgb) font.color = { argb: textArgb };
  if (Object.keys(font).length) cell.font = font;

  const fillArgb = toArgb(style.bg?.rgb);
  if (fillArgb) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
  }

  const horizontal = hAlign(style.ht);
  if (horizontal) cell.alignment = { ...cell.alignment, horizontal };

  const border = mapBorders(style.bd);
  if (border) cell.border = border as unknown as ExcelJS.Borders;
}

/* ---- Pure snapshot → ExcelJS workbook ------------------------------------- */

/** Populate one ExcelJS worksheet from a single sheet snapshot. Returns the
 *  number of rows that carried at least one cell. */
function populateWorksheet(ws: ExcelJS.Worksheet, sheet: SnapshotSheet | undefined, styles: WorkbookSnapshot["styles"]): number {
  const cellData = sheet?.cellData ?? {};
  const usedRows = new Set<number>();
  for (const [rowKey, cols] of Object.entries(cellData)) {
    const r = Number(rowKey);
    if (!cols) continue;
    for (const [colKey, cell] of Object.entries(cols)) {
      if (!cell) continue;
      const c = Number(colKey);
      const xc = ws.getCell(r + 1, c + 1);
      if (cell.f) {
        const formula = cell.f.replace(/^=/, "");
        xc.value = { formula, result: (cell.v as number | string | undefined) } as ExcelJS.CellFormulaValue;
      } else if (cell.v !== undefined && cell.v !== null) {
        xc.value = cell.v as ExcelJS.CellValue;
      }
      applyStyle(xc, resolveStyle(cell.s, styles));
      usedRows.add(r);
    }
  }

  // Column widths (px → approximate Excel character width).
  const columnData = sheet?.columnData ?? {};
  for (const [colKey, col] of Object.entries(columnData)) {
    const w = col?.w;
    if (typeof w === "number" && w > 0) {
      ws.getColumn(Number(colKey) + 1).width = Math.round((w / 7) * 100) / 100;
    }
  }

  // Merged cells.
  for (const m of sheet?.mergeData ?? []) {
    ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1);
  }

  // Frozen panes.
  const freeze = sheet?.freeze;
  if (freeze && ((freeze.xSplit ?? 0) > 0 || (freeze.ySplit ?? 0) > 0)) {
    ws.views = [{ state: "frozen", xSplit: freeze.xSplit ?? 0, ySplit: freeze.ySplit ?? 0 }];
  }

  return usedRows.size;
}

export function buildExcelWorkbook(snapshot: WorkbookSnapshot): { workbook: ExcelJS.Workbook; rowCount: number } {
  const wb = new ExcelJS.Workbook();
  const styles = snapshot.styles;

  // Export EVERY sheet in workbook order — not just sheetOrder[0]. A shell-workbook
  // download assembles all sheets into the snapshot, so serializing only the first
  // one silently produced a single-sheet file ("not the full excel").
  const order = snapshot.sheetOrder?.length ? snapshot.sheetOrder : Object.keys(snapshot.sheets ?? {});
  let rowCount = 0;
  let index = 0;
  const usedNames = new Set<string>();
  for (const sheetId of order) {
    const sheet = snapshot.sheets?.[sheetId];
    // Excel sheet names must be unique, ≤31 chars, and exclude : \ / ? * [ ].
    let name = (sheet?.name || `Sheet${index + 1}`).replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || `Sheet${index + 1}`;
    while (usedNames.has(name.toLowerCase())) name = `${name.slice(0, 28)}_${index + 1}`.slice(0, 31);
    usedNames.add(name.toLowerCase());
    const ws = wb.addWorksheet(name);
    rowCount += populateWorksheet(ws, sheet, styles);
    index++;
  }
  // Never emit a zero-sheet workbook (ExcelJS write would throw).
  if (wb.worksheets.length === 0) wb.addWorksheet("Sheet1");

  return { workbook: wb, rowCount };
}

/* ---- Browser download ----------------------------------------------------- */

function downloadBlob(data: ArrayBuffer | Uint8Array, fileName: string): void {
  const blob = new Blob([data as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export the live workbook to a downloaded .xlsx. Returns the number of rows
 * written, or 0 if the source isn't ready (no corrupt file is produced).
 */
export async function exportToXlsx(source: SnapshotSource | null | undefined, fileName = "sheet.xlsx"): Promise<number> {
  if (!source || typeof source.getSnapshot !== "function") return 0;
  const snapshot = source.getSnapshot();
  if (!snapshot || !snapshot.sheets) return 0;
  const { workbook, rowCount } = buildExcelWorkbook(snapshot);
  if (rowCount === 0) return 0;
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, fileName);
  return rowCount;
}
