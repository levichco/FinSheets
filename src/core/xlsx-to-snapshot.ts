/**
 * Rich XLSX → Univer snapshot converter (free-tier, client-only).
 *
 * Univer's own `importXLSXToSnapshotAsync` requires the Univer (Pro) server.
 * This module does the same job in the browser for free: it reads a workbook
 * with ExcelJS and emits a full `IWorkbookData` snapshot that Univer can render
 * directly — preserving cell VALUES, STYLES (fill / font / colour / bold /
 * italic / underline / strike / alignment / wrap / rotation / borders), NUMBER
 * FORMATS, DATES, MERGED CELLS, COLUMN WIDTHS, ROW HEIGHTS, FROZEN PANES and
 * ALL WORKSHEETS.
 *
 * Contrast with `parseFileToGrid` (import-data.ts), which flattens everything to
 * plain values and (because ExcelJS returns the master value for every slave
 * cell of a merge) duplicates merged content. This path fixes all of that.
 *
 * The heavy `exceljs` dependency is dynamically imported so it is only pulled in
 * when an actual import happens.
 */
import type { WorkbookData } from "./types";

/* -------------------------------------------------------------------------- */
/* Loose ExcelJS shapes (avoid tight coupling to exceljs' generics)           */
/* -------------------------------------------------------------------------- */
type Argb = { argb?: string; theme?: number; tint?: number };
interface XFont {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | string;
  strike?: boolean;
  color?: Argb;
}
interface XBorderEdge {
  style?: string;
  color?: Argb;
}
interface XCell {
  row: number;
  col: number;
  value: unknown;
  /** ExcelJS resolved-formula getter — populated for shared-formula slaves too. */
  formula?: string;
  type?: number;
  numFmt?: string;
  font?: XFont;
  fill?: { type?: string; pattern?: string; fgColor?: Argb; bgColor?: Argb };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean; textRotation?: number | string };
  border?: { top?: XBorderEdge; bottom?: XBorderEdge; left?: XBorderEdge; right?: XBorderEdge };
}
interface XRow {
  number: number;
  height?: number;
  eachCell(opts: { includeEmpty?: boolean }, cb: (cell: XCell, colNumber: number) => void): void;
}
interface XColumn {
  number?: number;
  width?: number;
}
interface XAnchor { nativeCol?: number; nativeColOff?: number; nativeRow?: number; nativeRowOff?: number; col?: number; row?: number }
interface XImageAnchor { imageId: string | number; range?: { tl?: XAnchor; br?: XAnchor; ext?: { width?: number; height?: number } } }
interface XWorksheet {
  name: string;
  rowCount: number;
  columnCount: number;
  actualColumnCount?: number;
  columns?: XColumn[];
  state?: string; // "visible" | "hidden" | "veryHidden"
  views?: Array<{ state?: string; xSplit?: number; ySplit?: number }>;
  model?: { merges?: string[] };
  eachRow(opts: { includeEmpty?: boolean }, cb: (row: XRow, rowNumber: number) => void): void;
  getImages?(): XImageAnchor[];
}
interface XMedia { type?: string; extension?: string; base64?: string; buffer?: Uint8Array | ArrayBuffer | { data?: number[] } }
interface XWorkbook { worksheets: XWorksheet[]; media?: XMedia[]; model?: { media?: XMedia[] } }

/** A floating image extracted from the xlsx, to be placed via the Facade after
 *  the sheet loads (Univer's snapshot drawing resource is not hand-authored). */
export interface ImportImage {
  sheetIndex: number;
  /** `data:image/…;base64,…` source. */
  base64: string;
  /** 0-based anchor cell + pixel offset within it. */
  col: number;
  row: number;
  colOffset: number;
  rowOffset: number;
  /** Rendered size in pixels. */
  width: number;
  height: number;
}

/* -------------------------------------------------------------------------- */
/* Univer style shape (short keys, matching build-workbook.ts / IStyleData)   */
/* -------------------------------------------------------------------------- */
type BorderSeg = { s: number; cl: { rgb: string } };
interface UStyle {
  bl?: number;
  it?: number;
  ul?: { s: number };
  st?: { s: number };
  fs?: number;
  ff?: string;
  cl?: { rgb: string };
  bg?: { rgb: string };
  ht?: number;
  vt?: number;
  tb?: number;
  tr?: { a: number; v: number };
  bd?: { t?: BorderSeg; b?: BorderSeg; l?: BorderSeg; r?: BorderSeg };
  n?: { pattern: string };
}
type UCell = { v?: string | number | boolean; f?: string; s?: string } | null;

/* ---- Colour ---------------------------------------------------------------
   The standard Office ("Office 2013+") theme palette, indexed the way Excel's
   cell `theme` attribute references it. NOTE the dk1/lt1 and dk2/lt2 SWAP:
   Excel's colour map swaps indices 0↔1 and 2↔3 relative to the raw scheme
   order, so `theme 0` = lt1 (white), `theme 1` = dk1 (BLACK), `theme 2` = lt2,
   `theme 3` = dk2. Getting this wrong turns black theme-text white (and vice
   versa). Explicit ARGB colours (the common case) don't use this table. */
const THEME_COLORS = [
  "#FFFFFF", "#000000", "#E7E6E6", "#44546A", "#4472C4", "#ED7D31",
  "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47", "#0563C1", "#954F72",
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace(/^#/, ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const to2 = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
const rgbToHex = (r: number, g: number, b: number) => `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();

/** Excel tint: negative darkens, positive lightens (approximated per-channel). */
function applyTint(hex: string, tint: number): string {
  if (!tint) return hex;
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => (tint < 0 ? c * (1 + tint) : c * (1 - tint) + 255 * tint);
  return rgbToHex(f(r), f(g), f(b));
}

function argbToHex(argb: string): string | null {
  let s = argb.replace(/^#/, "");
  if (s.length === 8) s = s.slice(2); // drop leading alpha
  if (s.length === 6) return `#${s.toUpperCase()}`;
  return null;
}

/** The legacy Excel 56-colour indexed palette (indices 8–63 are the usable
 *  colours; 64 = automatic/window-text, 65 = window-background). */
const INDEXED_PALETTE: Record<number, string> = {
  0: "#000000", 1: "#FFFFFF", 2: "#FF0000", 3: "#00FF00", 4: "#0000FF", 5: "#FFFF00", 6: "#FF00FF", 7: "#00FFFF",
  8: "#000000", 9: "#FFFFFF", 10: "#FF0000", 11: "#00FF00", 12: "#0000FF", 13: "#FFFF00", 14: "#FF00FF", 15: "#00FFFF",
  16: "#800000", 17: "#008000", 18: "#000080", 19: "#808000", 20: "#800080", 21: "#008080", 22: "#C0C0C0", 23: "#808080",
  24: "#9999FF", 25: "#993366", 26: "#FFFFCC", 27: "#CCFFFF", 28: "#660066", 29: "#FF8080", 30: "#0066CC", 31: "#CCCCFF",
  32: "#000080", 33: "#FF00FF", 34: "#FFFF00", 35: "#00FFFF", 36: "#800080", 37: "#800000", 38: "#008080", 39: "#0000FF",
  40: "#00CCFF", 41: "#CCFFFF", 42: "#CCFFCC", 43: "#FFFF99", 44: "#99CCFF", 45: "#FF99CC", 46: "#CC99FF", 47: "#FFCC99",
  48: "#3366FF", 49: "#33CCCC", 50: "#99CC00", 51: "#FFCC00", 52: "#FF9900", 53: "#FF6600", 54: "#666699", 55: "#969696",
  56: "#003366", 57: "#339966", 58: "#003300", 59: "#333300", 60: "#993300", 61: "#993366", 62: "#333399", 63: "#333333",
};

/** Resolve an ExcelJS colour object to a `#RRGGBB` hex, or null if unknown. */
function colorToHex(color?: Argb): string | null {
  if (!color) return null;
  if (typeof color.argb === "string") return argbToHex(color.argb);
  if (typeof color.theme === "number") {
    const base = THEME_COLORS[color.theme];
    return base ? applyTint(base, color.tint ?? 0) : null;
  }
  const indexed = (color as { indexed?: number }).indexed;
  if (typeof indexed === "number") {
    if (indexed === 64 || indexed === 65) return null; // automatic → let it default
    return INDEXED_PALETTE[indexed] ?? null;
  }
  return null;
}

/** Perceived luminance (0–255) of a hex colour. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/* ---- Borders -------------------------------------------------------------- */
const BORDER_STYLE_MAP: Record<string, number> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6,
  double: 7, medium: 8, mediumDashed: 9, mediumDashDot: 10,
  mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
};
function edge(b?: XBorderEdge): BorderSeg | null {
  if (!b || !b.style) return null;
  return { s: BORDER_STYLE_MAP[b.style] ?? 1, cl: { rgb: colorToHex(b.color) ?? "#000000" } };
}

/* ---- Alignment ------------------------------------------------------------ */
const H_ALIGN: Record<string, number> = { left: 1, center: 2, right: 3, justify: 4, fill: 1, centerContinuous: 2, distributed: 6 };
const V_ALIGN: Record<string, number> = { top: 1, middle: 2, bottom: 3, distributed: 2, justify: 2 };

/* ---- Dates ---------------------------------------------------------------- */
/** JS Date → Excel serial number (days since 1899-12-30, UTC-based). */
function dateToSerial(d: Date): number {
  const serial = d.getTime() / 86_400_000 + 25_569;
  return Math.round(serial * 1e6) / 1e6; // trim float noise, keep intraday time
}

/* -------------------------------------------------------------------------- */
/* Cell → { value, style }                                                    */
/* -------------------------------------------------------------------------- */
function cellValue(cell: XCell): { v?: string | number | boolean; f?: string; isDate?: boolean } {
  const v = cell.value;
  if (v == null) return {};
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return { v };
  if (v instanceof Date) return { v: dateToSerial(v), isDate: true };
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Formula cell. Prefer the RESOLVED `cell.formula` getter — for a shared-
    // formula slave the raw value only holds `{ sharedFormula: <master> }`, but
    // the getter returns this cell's own translated formula (e.g. Text(B16,…)).
    // Without it the slave came out as an empty but date-formatted cell → "NaN".
    if ((typeof cell.formula === "string" && cell.formula) || "formula" in o || "sharedFormula" in o) {
      const f = (typeof cell.formula === "string" && cell.formula) ? cell.formula : ((o.formula as string | undefined) || undefined);
      const res = o.result;
      const out: { v?: string | number | boolean; f?: string; isDate?: boolean } = {};
      if (f) out.f = `=${f}`;
      // Always carry the cached result as the value so the cell renders
      // immediately (Univer recalcs live formulas on top of it).
      if (res instanceof Date) { out.v = dateToSerial(res); out.isDate = true; }
      else if (typeof res === "number" || typeof res === "string" || typeof res === "boolean") out.v = res;
      else if (res && typeof res === "object" && "error" in (res as object)) out.v = String((res as { error?: unknown }).error ?? "");
      return out;
    }
    // Rich text: concat runs (per-run inline styling is flattened).
    if ("richText" in o && Array.isArray(o.richText)) return { v: (o.richText as Array<{ text?: string }>).map((t) => t.text ?? "").join("") };
    // Hyperlink cell: keep the display text.
    if ("text" in o) return { v: String(o.text ?? "") };
    if ("error" in o) return { v: String(o.error ?? "") };
  }
  return { v: String(v) };
}

function buildStyle(cell: XCell, isDate: boolean): UStyle {
  const s: UStyle = {};
  const font = cell.font;
  if (font) {
    if (font.bold) s.bl = 1;
    if (font.italic) s.it = 1;
    if (font.underline) s.ul = { s: 1 };
    if (font.strike) s.st = { s: 1 };
    if (font.size) s.fs = font.size;
    if (font.name) s.ff = font.name;
    const fc = colorToHex(font.color);
    if (fc) s.cl = { rgb: fc };
  }
  const fill = cell.fill;
  if (fill && fill.type === "pattern" && fill.pattern && fill.pattern !== "none") {
    const bg = colorToHex(fill.fgColor);
    if (bg) s.bg = { rgb: bg };
  }
  const al = cell.alignment;
  if (al) {
    const h = al.horizontal ? H_ALIGN[al.horizontal] : undefined;
    if (h) s.ht = h;
    const vv = al.vertical ? V_ALIGN[al.vertical] : undefined;
    if (vv) s.vt = vv;
    if (al.wrapText) s.tb = 3; // WrapStrategy.WRAP
    if (typeof al.textRotation === "number" && al.textRotation) s.tr = { a: al.textRotation, v: 0 };
  }
  const b = cell.border;
  if (b) {
    const bd: NonNullable<UStyle["bd"]> = {};
    const t = edge(b.top), bo = edge(b.bottom), l = edge(b.left), r = edge(b.right);
    if (t) bd.t = t;
    if (bo) bd.b = bo;
    if (l) bd.l = l;
    if (r) bd.r = r;
    if (Object.keys(bd).length) s.bd = bd;
  }
  if (cell.numFmt) s.n = { pattern: cell.numFmt };
  else if (isDate) s.n = { pattern: "yyyy-mm-dd" }; // date with no explicit format

  // Invisible-text guard: near-white font on a cell with NO background fill is
  // unreadable (white-on-white). This shows up in workpaper "note" blocks whose
  // text carries a light theme colour. Drop it so the text renders in the
  // default dark colour instead of vanishing.
  if (s.cl && !s.bg && luminance(s.cl.rgb) > 236) delete s.cl;
  return s;
}

/* -------------------------------------------------------------------------- */
/* Merges                                                                     */
/* -------------------------------------------------------------------------- */
interface Merge { startRow: number; startColumn: number; endRow: number; endColumn: number }

/** Parse a cell address ("AB12") to 0-based { row, col }. */
function parseAddr(addr: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(addr.trim().toUpperCase());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

/** Read a worksheet's merges as 0-based ranges + a Set of slave "r:c" keys. */
function readMerges(ws: XWorksheet): { merges: Merge[]; slaves: Set<string> } {
  const merges: Merge[] = [];
  const slaves = new Set<string>();
  const raw = ws.model?.merges ?? [];
  for (const range of raw) {
    const [a, b] = range.split(":");
    const s = parseAddr(a);
    const e = parseAddr(b ?? a);
    if (!s || !e) continue;
    const startRow = Math.min(s.row, e.row), endRow = Math.max(s.row, e.row);
    const startColumn = Math.min(s.col, e.col), endColumn = Math.max(s.col, e.col);
    merges.push({ startRow, startColumn, endRow, endColumn });
    for (let r = startRow; r <= endRow; r++)
      for (let c = startColumn; c <= endColumn; c++)
        if (!(r === startRow && c === startColumn)) slaves.add(`${r}:${c}`);
  }
  return { merges, slaves };
}

/* ---- Dimensions ----------------------------------------------------------- */
const ROW_HEADROOM = 30;
const COL_HEADROOM = 4;
const MIN_ROWS = 100;
const MIN_COLS = 26;
const DEFAULT_COL_WIDTH = 88; // Excel-ish default (~8.43 chars)
const DEFAULT_ROW_HEIGHT_PX = 24; // Univer default row height
const EMU_PER_PX = 9525; // Excel drawing units (English Metric Units) per pixel
/** Excel column width (char units) → pixels. */
const charWidthToPx = (w: number) => Math.round(w * 7 + 5);
/** Excel row height (points) → pixels. */
const ptToPx = (pt: number) => Math.round(pt * (96 / 72));

/** Browser-safe bytes → base64 (chunked to avoid arg-count limits). */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function toU8(buf: Uint8Array | ArrayBuffer | { data?: number[] } | undefined): Uint8Array | null {
  if (!buf) return null;
  if (buf instanceof Uint8Array) return buf;
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
  if (Array.isArray((buf as { data?: number[] }).data)) return new Uint8Array((buf as { data: number[] }).data);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Helpers for inserting imported sheets into an EXISTING workbook            */
/* -------------------------------------------------------------------------- */

/** Map original worksheet index → sheet name, from a converted snapshot. */
export function sheetIndexToName(snapshot: WorkbookData): Record<number, string> {
  const order = (snapshot.sheetOrder as string[] | undefined) ?? [];
  const sheets = (snapshot.sheets as Record<string, { name?: string }> | undefined) ?? {};
  const map: Record<number, string> = {};
  order.forEach((id, i) => { map[i] = sheets[id]?.name ?? `Sheet${i + 1}`; });
  return map;
}

/**
 * Resolve a sheet's registry style ids to INLINE style objects. Needed when a
 * sheet from an imported snapshot is inserted into a different workbook (via the
 * Facade `create(..., { sheet })`) whose style registry doesn't hold those ids —
 * otherwise every styled cell would lose its formatting.
 */
export function inlineSheetStyles(sheet: Record<string, unknown>, styles: Record<string, unknown>): Record<string, unknown> {
  const cellData = sheet.cellData as Record<string, Record<string, { s?: unknown } | null>> | undefined;
  if (!cellData) return sheet;
  const out: Record<number, Record<number, unknown>> = {};
  for (const [r, cols] of Object.entries(cellData)) {
    const row: Record<number, unknown> = {};
    for (const [c, cell] of Object.entries(cols)) {
      if (cell && typeof cell === "object" && typeof (cell as { s?: unknown }).s === "string") {
        row[Number(c)] = { ...cell, s: styles[(cell as { s: string }).s] ?? undefined };
      } else {
        row[Number(c)] = cell;
      }
    }
    out[Number(r)] = row;
  }
  return { ...sheet, cellData: out };
}

/** The first VISIBLE sheet of a converted snapshot (or the first, if all hidden). */
export function firstVisibleSheet(snapshot: WorkbookData): Record<string, unknown> | null {
  const order = (snapshot.sheetOrder as string[] | undefined) ?? [];
  const sheets = (snapshot.sheets as Record<string, Record<string, unknown>> | undefined) ?? {};
  for (const id of order) {
    const s = sheets[id];
    if (s && s.hidden !== 1) return s;
  }
  return order.length ? sheets[order[0]] ?? null : null;
}

/**
 * Build a rich in-place placement of ONE imported sheet at a (row,col) offset:
 * a sparse ICellData matrix (styles inlined) + shifted merge rectangles. Used to
 * bring imported content into an EXISTING sheet (replace-current / append /
 * at-cell) with full formatting — not just plain values.
 */
export function buildRichPlacement(
  sheet: Record<string, unknown>,
  styles: Record<string, unknown>,
  rowOffset: number,
  colOffset: number,
): { cells: Record<number, Record<number, unknown>>; merges: Array<{ row: number; col: number; numRows: number; numCols: number }>; maxRow: number; maxCol: number } {
  const resolved = inlineSheetStyles(sheet, styles);
  const cd = (resolved.cellData as Record<string, Record<string, unknown>> | undefined) ?? {};
  const cells: Record<number, Record<number, unknown>> = {};
  let maxRow = 0;
  let maxCol = 0;
  for (const [r, cols] of Object.entries(cd)) {
    const rr = Number(r) + rowOffset;
    for (const [c, cell] of Object.entries(cols)) {
      const cc = Number(c) + colOffset;
      (cells[rr] ??= {})[cc] = cell;
      if (rr > maxRow) maxRow = rr;
      if (cc > maxCol) maxCol = cc;
    }
  }
  const mergeData = (sheet.mergeData as Array<{ startRow: number; startColumn: number; endRow: number; endColumn: number }> | undefined) ?? [];
  const merges = mergeData.map((m) => ({
    row: m.startRow + rowOffset,
    col: m.startColumn + colOffset,
    numRows: m.endRow - m.startRow + 1,
    numCols: m.endColumn - m.startColumn + 1,
  }));
  return { cells, merges, maxRow, maxCol };
}

/* ---- Facade image placement (shared by whole-doc render + sheet insert) ---- */
interface FImgBuilder {
  setSource(src: string, type?: unknown): FImgBuilder;
  setColumn(c: number): FImgBuilder;
  setRow(r: number): FImgBuilder;
  setWidth(w: number): FImgBuilder;
  setHeight(h: number): FImgBuilder;
  buildAsync(): Promise<unknown>;
}
interface FImgSheet {
  getSheetName?: () => string;
  newOverGridImage?: () => FImgBuilder;
  insertImages?: (images: unknown[]) => void;
  insertImage?: (url: string, column?: number, row?: number, offsetX?: number, offsetY?: number) => Promise<boolean>;
}
interface FImgApi {
  getActiveWorkbook?: () => { getSheets?: () => FImgSheet[] } | null;
  Enum?: { ImageSourceType?: { BASE64?: unknown } };
}

/**
 * Place imported floating images on their target sheets via the Facade, matching
 * by sheet NAME (robust to index shifts when inserting into an existing
 * workbook). Best-effort — logs a summary and never throws.
 */
export async function placeImportImages(api: unknown, images: ImportImage[], indexToName: Record<number, string>): Promise<void> {
  try {
    const a = api as FImgApi;
    const sheets = a.getActiveWorkbook?.()?.getSheets?.() ?? [];
    const byName = new Map<string, FImgSheet>();
    for (const s of sheets) {
      const n = s.getSheetName?.();
      if (n) byName.set(n, s);
    }
    const sourceType = a.Enum?.ImageSourceType?.BASE64 ?? "BASE64";
    const groups = new Map<string, ImportImage[]>();
    for (const im of images) {
      const name = indexToName[im.sheetIndex];
      if (!name) continue;
      const list = groups.get(name) ?? [];
      list.push(im);
      groups.set(name, list);
    }
    let placed = 0;
    for (const [name, ims] of groups) {
      const fws = byName.get(name);
      if (!fws) continue;
      if (fws.newOverGridImage && fws.insertImages) {
        const built: unknown[] = [];
        for (const im of ims) {
          try {
            const b = await fws.newOverGridImage().setSource(im.base64, sourceType).setColumn(im.col).setRow(im.row).setWidth(im.width).setHeight(im.height).buildAsync();
            if (b) built.push(b);
          } catch (e) {
            console.warn("[levich] image build failed", e);
          }
        }
        if (built.length) {
          try {
            fws.insertImages(built);
            placed += built.length;
          } catch (e) {
            console.warn("[levich] insertImages failed", e);
          }
        }
      } else if (fws.insertImage) {
        for (const im of ims) {
          try {
            await fws.insertImage(im.base64, im.col, im.row, im.colOffset, im.rowOffset);
            placed += 1;
          } catch (e) {
            console.warn("[levich] insertImage failed", e);
          }
        }
      }
    }
    console.info(`[levich] imported images: ${images.length} found, ${placed} placed`);
  } catch (e) {
    console.warn("[levich] placeImportImages error", e);
  }
}

/* -------------------------------------------------------------------------- */
/* Public: convert a File / ArrayBuffer to a Univer snapshot                  */
/* -------------------------------------------------------------------------- */
export async function parseXlsxToSnapshot(file: File): Promise<WorkbookData> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  // One workbook-wide style registry; cells reference styles by id (keeps the
  // snapshot small when a style repeats — headers, fills, etc.).
  const styles: Record<string, UStyle> = {};
  const styleIndex = new Map<string, string>();
  let styleSeq = 0;
  const internStyle = (style: UStyle): string | undefined => {
    if (!style || Object.keys(style).length === 0) return undefined;
    const key = JSON.stringify(style);
    let id = styleIndex.get(key);
    if (!id) {
      id = `s${++styleSeq}`;
      styleIndex.set(key, id);
      styles[id] = style;
    }
    return id;
  };

  const WORKBOOK_ID = "levich-imported";
  const sheetOrder: string[] = [];
  const sheets: Record<string, unknown> = {};
  const images: ImportImage[] = [];
  // Native Univer drawing resource, keyed by sheetId → { data, order }. Embedded
  // in the snapshot so images render at LOAD time (the post-load Facade insert
  // proved unreliable).
  const drawingResource: Record<string, { data: Record<string, unknown>; order: string[] }> = {};
  const wbx = wb as unknown as XWorkbook;
  const media = wbx.media ?? wbx.model?.media ?? [];

  (wb.worksheets as unknown as XWorksheet[]).forEach((ws, index) => {
    const sheetId = `sheet_${index + 1}`;
    sheetOrder.push(sheetId);

    const { merges, slaves } = readMerges(ws);
    const cellData: Record<number, Record<number, UCell>> = {};
    // Wrapped cells (for auto-fit row-height estimation): text + font size + col.
    const wrapInfo: Array<{ r: number; c: number; text: string; fs: number }> = [];
    let maxRow = 0;
    let maxCol = 0;

    ws.eachRow({ includeEmpty: true }, (row) => {
      const r = row.number - 1;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const c = colNumber - 1;
        if (slaves.has(`${r}:${c}`)) return; // merge slave — leave empty
        const { v, f, isDate } = cellValue(cell);
        const style = buildStyle(cell, !!isDate);
        if (style.tb === 3 && v !== undefined && v !== "") {
          wrapInfo.push({ r, c, text: String(v), fs: style.fs ?? 11 }); // for auto-fit
        }
        // An EMPTY cell that still carries a date/number format makes Univer
        // format "nothing" → renders "NaN". Drop the format when there's no
        // value or formula to display.
        if (v === undefined && f === undefined && style.n) delete style.n;
        const sid = internStyle(style);
        // Skip cells that carry neither a value/formula nor any styling.
        if (v === undefined && f === undefined && !sid) return;
        const out: UCell = {};
        if (f !== undefined) out.f = f;
        if (v !== undefined) out.v = v;
        if (sid) out.s = sid;
        (cellData[r] ??= {})[c] = out;
        if (r > maxRow) maxRow = r;
        if (c > maxCol) maxCol = c;
      });
    });

    // Column widths.
    const columnData: Record<number, { w: number }> = {};
    (ws.columns ?? []).forEach((col, i) => {
      const idx = (col?.number ?? i + 1) - 1;
      if (col?.width && col.width > 0) columnData[idx] = { w: charWidthToPx(col.width) };
    });

    // Row heights. Rows with an explicit stored height are pinned as-is. For
    // rows whose wrapped text has NO stored height (Excel/Sheets auto-fit them
    // but don't persist the computed height), ESTIMATE the height from the text
    // length vs. the available column width — Univer's own `ia` auto-fit isn't
    // computed at snapshot-load, so an explicit height is the only reliable way
    // to stop multi-line headers / notes from rendering clipped.
    const rowData: Record<number, { h?: number }> = {};
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (row.height && row.height > 0) rowData[row.number - 1] = { h: ptToPx(row.height) };
    });
    {
      const colW = (c: number) => columnData[c]?.w ?? DEFAULT_COL_WIDTH;
      const spanCols = new Map<string, number>();
      for (const m of merges) spanCols.set(`${m.startRow}:${m.startColumn}`, m.endColumn - m.startColumn + 1);
      const neededLines: Record<number, number> = {};
      const rowFs: Record<number, number> = {};
      for (const info of wrapInfo) {
        if (rowData[info.r]?.h) continue; // explicit height wins
        let widthPx = colW(info.c);
        const span = spanCols.get(`${info.r}:${info.c}`);
        if (span && span > 1) { widthPx = 0; for (let k = 0; k < span; k++) widthPx += colW(info.c + k); }
        const avgChar = info.fs * 0.56; // ≈ px per character
        const charsPerLine = Math.max(1, Math.floor((widthPx - 8) / avgChar));
        let lines = 0;
        for (const seg of info.text.split("\n")) lines += Math.max(1, Math.ceil(seg.length / charsPerLine));
        neededLines[info.r] = Math.max(neededLines[info.r] ?? 1, lines);
        rowFs[info.r] = Math.max(rowFs[info.r] ?? 11, info.fs);
      }
      for (const [rStr, lines] of Object.entries(neededLines)) {
        const r = Number(rStr);
        if (lines > 1 && !rowData[r]?.h) {
          const lineH = Math.round((rowFs[r] ?? 11) * 1.5); // comfortable line height
          rowData[r] = { h: Math.min(600, lines * lineH + 6) };
        }
      }
    }

    // Floating images (logos, equation graphics, etc.). Excel stores these as
    // drawings anchored to cells with EMU offsets; extract source + anchor +
    // pixel size so the Facade can place them after load.
    try {
      const colPx = (c: number) => columnData[c]?.w ?? DEFAULT_COL_WIDTH;
      const rowPx = (r: number) => rowData[r]?.h ?? DEFAULT_ROW_HEIGHT_PX;
      const sumW = (upto: number) => { let s = 0; for (let c = 0; c < upto; c++) s += colPx(c); return s; };
      const sumH = (upto: number) => { let s = 0; for (let r = 0; r < upto; r++) s += rowPx(r); return s; };
      const posAtX = (px: number) => { let acc = 0, i = 0; while (acc + colPx(i) <= px && i < 16384) { acc += colPx(i); i++; } return { column: i, columnOffset: Math.round(px - acc) }; };
      const posAtY = (px: number) => { let acc = 0, i = 0; while (acc + rowPx(i) <= px && i < 1048576) { acc += rowPx(i); i++; } return { row: i, rowOffset: Math.round(px - acc) }; };
      let imgIdx = 0;
      for (const img of ws.getImages?.() ?? []) {
        const m = media[Number(img.imageId)];
        if (!m) continue;
        const ext = (m.extension || "png").toLowerCase();
        const mime = ext === "jpg" ? "jpeg" : ext;
        // Prefer an inline base64 if ExcelJS provides one, else encode the buffer.
        let base64: string;
        if (typeof m.base64 === "string" && m.base64) {
          base64 = m.base64.startsWith("data:") ? m.base64 : `data:image/${mime};base64,${m.base64}`;
        } else {
          const bytes = toU8(m.buffer);
          if (!bytes) continue;
          base64 = `data:image/${mime};base64,${bytesToBase64(bytes)}`;
        }
        const tl = img.range?.tl ?? {};
        const br = img.range?.br;
        const ext2 = img.range?.ext;
        const col = tl.nativeCol ?? tl.col ?? 0;
        const row = tl.nativeRow ?? tl.row ?? 0;
        const colOffset = (tl.nativeColOff ?? 0) / EMU_PER_PX;
        const rowOffset = (tl.nativeRowOff ?? 0) / EMU_PER_PX;
        let width = 120;
        let height = 60;
        if (br && typeof br.nativeCol === "number" && typeof br.nativeRow === "number") {
          // twoCellAnchor: size = span from top-left to bottom-right anchor.
          let w = 0;
          for (let c = col; c < br.nativeCol; c++) w += colPx(c);
          width = w - colOffset + (br.nativeColOff ?? 0) / EMU_PER_PX;
          let h = 0;
          for (let r = row; r < br.nativeRow; r++) h += rowPx(r);
          height = h - rowOffset + (br.nativeRowOff ?? 0) / EMU_PER_PX;
        } else if (ext2?.width && ext2?.height) {
          // oneCellAnchor: ExcelJS already converts `ext` from EMU to PIXELS
          // (unlike the col/row offsets, which stay in EMU). Use it directly.
          width = ext2.width;
          height = ext2.height;
        }
        const wPx = Math.max(8, Math.round(width));
        const hPx = Math.max(8, Math.round(height));
        const colOff = Math.max(0, Math.round(colOffset));
        const rowOff = Math.max(0, Math.round(rowOffset));
        images.push({ sheetIndex: index, base64, col, row, colOffset: colOff, rowOffset: rowOff, width: wPx, height: hPx });

        // Native drawing object (rendered at load via the SHEET_DRAWING_PLUGIN
        // resource). transform = absolute px box; sheetTransform = from/to cell
        // anchors so it tracks the grid.
        const left = Math.round(sumW(col) + colOffset);
        const top = Math.round(sumH(row) + rowOffset);
        const toX = posAtX(left + wPx);
        const toY = posAtY(top + hPx);
        const from = { column: col, columnOffset: colOff, row, rowOffset: rowOff };
        const to = { column: toX.column, columnOffset: toX.columnOffset, row: toY.row, rowOffset: toY.rowOffset };
        const drawingId = `img_${index}_${imgIdx++}`;
        const drawing = {
          unitId: WORKBOOK_ID,
          subUnitId: sheetId,
          drawingId,
          drawingType: 0, // DrawingTypeEnum.DRAWING_IMAGE
          imageSourceType: "BASE64",
          source: base64,
          transform: { left, top, width: wPx, height: hPx, angle: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, flipX: false, flipY: false },
          sheetTransform: { from: { ...from }, to: { ...to } },
          axisAlignSheetTransform: { from: { ...from }, to: { ...to } },
          anchorType: "1", // SheetDrawingAnchorType.Both
        };
        (drawingResource[sheetId] ??= { data: {}, order: [] });
        drawingResource[sheetId].data[drawingId] = drawing;
        drawingResource[sheetId].order.push(drawingId);
      }
    } catch (e) {
      console.warn("[levich] image extraction failed", e);
    }

    // Frozen panes.
    const view = ws.views?.find((vw) => vw.state === "frozen");
    const xSplit = view?.xSplit ?? 0;
    const ySplit = view?.ySplit ?? 0;
    const freeze = { xSplit, ySplit, startRow: ySplit, startColumn: xSplit };

    const rowCount = Math.max(maxRow + 1, ws.rowCount || 0, MIN_ROWS) + ROW_HEADROOM;
    const columnCount = Math.max(maxCol + 1, ws.actualColumnCount || ws.columnCount || 0, MIN_COLS) + COL_HEADROOM;

    sheets[sheetId] = {
      id: sheetId,
      name: ws.name || `Sheet${index + 1}`,
      rowCount,
      columnCount,
      cellData,
      columnData,
      rowData,
      defaultColumnWidth: DEFAULT_COL_WIDTH,
      mergeData: merges,
      freeze,
      // Respect Excel's hidden/veryHidden sheets — imported (data preserved)
      // but not shown as tabs, matching how the source app displays them.
      hidden: ws.state && ws.state !== "visible" ? 1 : 0,
    };
  });

  // A workbook with no worksheets — hand back a single empty sheet.
  if (sheetOrder.length === 0) {
    const id = "sheet_1";
    sheetOrder.push(id);
    sheets[id] = { id, name: "Sheet1", rowCount: MIN_ROWS, columnCount: MIN_COLS, cellData: {} };
  }

  const baseName = file.name.replace(/\.(xlsx|xls)$/i, "") || "Imported";
  // Embed images as Univer's native drawing resource so they render at load.
  const resources = Object.keys(drawingResource).length
    ? [{ name: "SHEET_DRAWING_PLUGIN", data: JSON.stringify(drawingResource) }]
    : [];
  return {
    id: WORKBOOK_ID,
    name: baseName,
    sheetOrder,
    styles,
    sheets,
    resources,
    // Non-Univer field: floating images for the Facade path (used when inserting
    // imported sheets into an EXISTING workbook, which bypasses the snapshot
    // resource). Univer ignores unknown top-level keys.
    drawingsImport: images,
  } as WorkbookData;
}
