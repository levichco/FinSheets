/**
 * Interactive pivot engine (Excel / Google-Sheets grade), free-tier — no Univer Pro.
 *
 * `computePivotModel` buckets a `PivotSource` into a nested ROW tree × flat COLUMN
 * leaves × multiple value fields, computing per-group aggregates, per-level SUBTOTALS
 * and GRAND totals. Crucially, subtotals/totals aggregate the UNDERLYING values (not a
 * sum of child aggregates) so `average`/`min`/`max` match Excel exactly.
 *
 * `renderPivotModel` walks that tree into styled `cellData`, honouring collapse,
 * compact-vs-tabular layout, per-value number formats, and indent (via the same `pd.l`
 * left-padding used for imported pivots).
 */
import { ALIGN_RIGHT, NUMBER_PATTERN } from "./formatting";
import type { Cell, CellStyle, PivotAggregate, PivotModel, PivotNode, PivotSource, PivotSpec, PivotValueField } from "../core/types";

const SEP = "␟"; // ␟ — a path separator that won't collide with real field values.

function aggregate(values: number[], agg: PivotAggregate): number {
  const nums = values;
  switch (agg) {
    case "count":
      return nums.length;
    case "countNumbers":
      return nums.filter((n) => Number.isFinite(n)).length;
    case "average": {
      const f = nums.filter((n) => Number.isFinite(n));
      return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0;
    }
    case "min": {
      // Exclude non-numbers (text / blanks) like Excel's MIN — else one stray "N/A"
      // poisons the whole group to NaN.
      const f = nums.filter(Number.isFinite);
      return f.length ? Math.min(...f) : 0;
    }
    case "max": {
      const f = nums.filter(Number.isFinite);
      return f.length ? Math.max(...f) : 0;
    }
    case "sum":
    default:
      return nums.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
  }
}

/** Default header label for a value field, e.g. "Sum of Amount". */
export function valueLabel(v: PivotValueField): string {
  if (v.label) return v.label;
  const verb: Record<PivotAggregate, string> = {
    sum: "Sum",
    count: "Count",
    countNumbers: "Count",
    average: "Average",
    min: "Min",
    max: "Max",
  };
  return `${verb[v.aggregate]} of ${v.field}`;
}

const num = (x: unknown): number => {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : NaN;
};

/** Compute the full pivot tree from a source + spec. */
export function computePivotModel(source: PivotSource, spec: PivotSpec): PivotModel {
  const values = spec.values.length ? spec.values : [{ field: source.fields[0] ?? "value", aggregate: "count" as PivotAggregate }];

  // 1. Filter rows.
  const filters = spec.filters ?? [];
  const rows = source.rows.filter((r) => filters.every((f) => !f.include || f.include.includes(String(r[f.field] ?? ""))));

  // 2. Raw value buckets: rowLeafPath → colLeafPath → valueIndex → number[].
  const raw = new Map<string, Map<string, number[][]>>();
  const rowLeafOrder: string[] = [];
  const colLeafSet = new Map<string, string[]>(); // colPath → the ordered key parts (for header tree)
  const seenRowLeaf = new Set<string>();

  const pathOf = (r: Record<string, unknown>, fields: string[]): { parts: string[]; path: string } => {
    const parts = fields.map((f) => String(r[f] ?? ""));
    return { parts, path: parts.join(SEP) };
  };

  for (const r of rows) {
    const rl = pathOf(r, spec.rows);
    const cl = pathOf(r, spec.columns);
    if (!seenRowLeaf.has(rl.path)) {
      seenRowLeaf.add(rl.path);
      rowLeafOrder.push(rl.path);
    }
    if (!colLeafSet.has(cl.path)) colLeafSet.set(cl.path, cl.parts);
    if (!raw.has(rl.path)) raw.set(rl.path, new Map());
    const byCol = raw.get(rl.path)!;
    if (!byCol.has(cl.path)) byCol.set(cl.path, values.map(() => []));
    const vArr = byCol.get(cl.path)!;
    values.forEach((v, vi) => vArr[vi].push(num(r[v.field])));
  }

  const colLeaves = [...colLeafSet.keys()];

  // 3. Aggregate a set of rowLeafPaths across a colPath + valueIndex. `colPath === null`
  //    means "all columns" — the raw underlying values are UNIONED across every column so
  //    the row/grand Total is exact for every aggregation (an average total is the average
  //    of all underlying values, NOT an average of the per-column averages — like Excel).
  const aggFor = (rowLeaves: string[], colPath: string | null, vi: number): number => {
    const acc: number[] = [];
    for (const rl of rowLeaves) {
      const byCol = raw.get(rl);
      if (!byCol) continue;
      if (colPath === null) {
        for (const arr of byCol.values()) for (const n of arr[vi]) acc.push(n);
      } else {
        const arr = byCol.get(colPath)?.[vi];
        if (arr) for (const n of arr) acc.push(n);
      }
    }
    return aggregate(acc, values[vi].aggregate);
  };
  // Cell key: `${colPath}${SEP}${vi}` (colPath="" for the row Total column).
  const cellKey = (colPath: string, vi: number) => `${colPath}${SEP}${vi}`;

  // 4. Build the nested row tree from the ordered leaf paths.
  interface Build {
    key: string;
    path: string;
    level: number;
    children: Map<string, Build>;
    childOrder: string[];
    leaves: string[]; // rowLeafPaths under this node
  }
  const rootChildren = new Map<string, Build>();
  const rootOrder: string[] = [];
  for (const leaf of rowLeafOrder) {
    const parts = leaf.split(SEP);
    let map = rootChildren;
    let order = rootOrder;
    let prefix = "";
    for (let lvl = 0; lvl < parts.length; lvl++) {
      const key = parts[lvl];
      prefix = lvl === 0 ? key : `${prefix}${SEP}${key}`;
      if (!map.has(key)) {
        map.set(key, { key, path: prefix, level: lvl, children: new Map(), childOrder: [], leaves: [] });
        order.push(key);
      }
      const node = map.get(key)!;
      node.leaves.push(leaf);
      map = node.children;
      order = node.childOrder;
    }
  }

  const finalize = (b: Build): PivotNode => {
    const node: PivotNode = { key: b.key, path: b.path, level: b.level, children: [], values: new Map() };
    // Aggregate this node across every column leaf + the row Total (all columns unioned).
    values.forEach((_, vi) => {
      for (const col of colLeaves) node.values.set(cellKey(col, vi), aggFor(b.leaves, col, vi));
      node.values.set(cellKey("", vi), aggFor(b.leaves, null, vi));
    });
    node.children = b.childOrder.map((k) => finalize(b.children.get(k)!));
    return node;
  };
  const rowTree = rootOrder.map((k) => finalize(rootChildren.get(k)!));

  // 5. Grand totals (over ALL leaves).
  const allLeaves = rowLeafOrder;
  const grand = new Map<string, number>();
  values.forEach((_, vi) => {
    for (const col of colLeaves) grand.set(cellKey(col, vi), aggFor(allLeaves, col, vi));
    grand.set(cellKey("", vi), aggFor(allLeaves, null, vi));
  });

  // 6. Column header tree (levels of the column fields).
  const colTree = buildColTree(colLeaves);

  return { spec, rowTree, colLeaves, colTree, grand, values };
}

function buildColTree(colLeaves: string[]): PivotNode[] {
  const roots: PivotNode[] = [];
  const byKey = new Map<string, PivotNode>();
  for (const leaf of colLeaves) {
    if (leaf === "") continue;
    const parts = leaf.split(SEP);
    let siblings = roots;
    let prefix = "";
    for (let lvl = 0; lvl < parts.length; lvl++) {
      prefix = lvl === 0 ? parts[lvl] : `${prefix}${SEP}${parts[lvl]}`;
      let node = byKey.get(prefix);
      if (!node) {
        node = { key: parts[lvl], path: prefix, level: lvl, children: [], values: new Map() };
        byKey.set(prefix, node);
        siblings.push(node);
      }
      siblings = node.children;
    }
  }
  return roots;
}

/* ─── Render ────────────────────────────────────────────────────────────────── */

const HEADER_STYLE: CellStyle = { bl: 1, bg: { rgb: "#F9FAFB" }, cl: { rgb: "#475467" } };
const TOTAL_LABEL_STYLE: CellStyle = { bl: 1, bg: { rgb: "#F9FAFB" } };
const numStyle = (pattern: string, total = false): CellStyle =>
  total ? { n: { pattern }, ht: ALIGN_RIGHT, bl: 1, bg: { rgb: "#F9FAFB" } } : { n: { pattern }, ht: ALIGN_RIGHT };
const indentStyle = (level: number, extra?: CellStyle): CellStyle => (level > 0 ? { ...extra, pd: { l: level * 12 } } : { ...extra });

export interface RenderedPivot {
  cells: Record<number, Record<number, Cell>>;
  rowCount: number;
  columnCount: number;
}

/** Render a computed pivot model into a styled cell region. */
export function renderPivotModel(model: PivotModel): RenderedPivot {
  const { spec, colLeaves, values } = model;
  const collapsed = new Set(spec.collapsed ?? []);
  const showRowSubtotals = spec.showRowSubtotals ?? spec.rows.length > 1;
  const showGrand = spec.showGrandTotals ?? { row: true, column: true };
  const realCols = colLeaves.filter((c) => c !== "");

  const cells: Record<number, Record<number, Cell>> = {};
  const set = (r: number, c: number, cell: Cell) => {
    (cells[r] ??= {})[c] = cell;
  };

  // Column geometry: col 0 = row labels; then (realCols × values); then value Totals (if showGrand.column).
  const nValues = values.length;
  const dataStart = 1;
  const totalStart = dataStart + realCols.length * nValues;
  const columnCount = totalStart + (showGrand.column ? nValues : 0);

  // Header rows: a column-key header line per column level (if any), then the value labels.
  const colDepth = spec.columns.length;
  let headerRows = 0;
  const cellKey = (colPath: string, vi: number) => `${colPath}${SEP}${vi}`;

  // Column-group header (single flattened line for simplicity of the compact view).
  if (colDepth > 0) {
    const hr = headerRows;
    set(hr, 0, { v: "", s: HEADER_STYLE });
    realCols.forEach((col, ci) => {
      const label = col.split(SEP).join(" / ");
      // Blank-fill the group's span, then write the column label on the FIRST sub-column of
      // the group so a multi-value pivot (e.g. Sum | Count under each column) unambiguously
      // shows which column each value pair belongs to (Excel puts the group label above the span).
      values.forEach((_, vi) => set(hr, dataStart + ci * nValues + vi, { v: "", s: HEADER_STYLE }));
      set(hr, dataStart + ci * nValues, { v: label, s: HEADER_STYLE });
    });
    headerRows++;
  }
  // Value-label header line.
  {
    const hr = headerRows;
    set(hr, 0, { v: spec.rows.join(" / ") || "", s: HEADER_STYLE });
    realCols.forEach((col, ci) => {
      values.forEach((v, vi) => {
        const label = nValues > 1 || colDepth === 0 ? valueLabel(v) : col.split(SEP).join(" / ");
        set(hr, dataStart + ci * nValues + vi, { v: label, s: HEADER_STYLE });
      });
    });
    if (showGrand.column) values.forEach((v, vi) => set(hr, totalStart + vi, { v: nValues > 1 ? `Total ${valueLabel(v)}` : "Grand Total", s: HEADER_STYLE }));
    headerRows++;
  }

  // Body rows: walk the row tree depth-first, emitting a row per node (+ subtotal when it has children).
  let r = headerRows;
  const emitValueCells = (row: number, node: PivotNode | null, total: boolean) => {
    realCols.forEach((col, ci) => {
      values.forEach((v, vi) => {
        const val = node ? node.values.get(cellKey(col, vi)) : model.grand.get(cellKey(col, vi));
        set(row, dataStart + ci * nValues + vi, { v: val ?? 0, s: numStyle(v.numFmt ?? NUMBER_PATTERN, total) });
      });
    });
    if (showGrand.column) {
      values.forEach((v, vi) => {
        const val = node ? node.values.get(cellKey("", vi)) : model.grand.get(cellKey("", vi));
        set(row, totalStart + vi, { v: val ?? 0, s: numStyle(v.numFmt ?? NUMBER_PATTERN, true) });
      });
    }
  };

  const walk = (nodes: PivotNode[]) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed.has(node.path);
      const chevron = hasChildren ? (isCollapsed ? "▸ " : "▾ ") : "";
      // Group header / leaf row.
      set(r, 0, { v: `${chevron}${node.key}`, s: indentStyle(node.level, hasChildren ? { bl: 1 } : undefined) });
      emitValueCells(r, node, false);
      r++;
      if (hasChildren && !isCollapsed) {
        walk(node.children);
        if (showRowSubtotals) {
          set(r, 0, { v: `${node.key} Total`, s: indentStyle(node.level, TOTAL_LABEL_STYLE) });
          emitValueCells(r, node, true);
          r++;
        }
      }
    }
  };
  walk(model.rowTree);

  // Grand-total row.
  if (showGrand.row) {
    set(r, 0, { v: "Grand Total", s: TOTAL_LABEL_STYLE });
    emitValueCells(r, null, true);
    r++;
  }

  return { cells, rowCount: r, columnCount };
}
