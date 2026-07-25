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
import { evalFormula } from "./pivot-formula";
import type { Cell, CellStyle, PivotAggregate, PivotFilterCondition, PivotGroupRule, PivotModel, PivotNode, PivotSource, PivotSpec, PivotValueField } from "../core/types";

const SEP = "␟"; // ␟ — a path separator that won't collide with real field values.
// Dedicated colPath for the row-Total column. A NUL byte can't appear in a stringified
// cell value, so this never collides with a real (or blank) column-field path.
export const ROW_TOTAL = "\u0000TOTAL";

function aggregate(values: number[], agg: PivotAggregate): number {
  const nums = values;
  const f = nums.filter(Number.isFinite);
  switch (agg) {
    case "count":
      return nums.length;
    case "countNumbers":
      return f.length;
    case "countunique":
      return new Set(f).size;
    case "average":
      return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0;
    case "min":
      // Exclude non-numbers (text / blanks) like Excel's MIN — else one stray "N/A"
      // poisons the whole group to NaN.
      return f.length ? Math.min(...f) : 0;
    case "max":
      return f.length ? Math.max(...f) : 0;
    case "median": {
      if (!f.length) return 0;
      const s = [...f].sort((x, y) => x - y);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    case "product":
      return f.length ? f.reduce((p, x) => p * x, 1) : 0;
    case "var":
    case "stdev": {
      if (f.length < 2) return 0;
      const mean = f.reduce((s, x) => s + x, 0) / f.length;
      const v = f.reduce((s, x) => s + (x - mean) ** 2, 0) / (f.length - 1);
      return agg === "var" ? v : Math.sqrt(v);
    }
    case "varp":
    case "stdevp": {
      if (!f.length) return 0;
      const mean = f.reduce((s, x) => s + x, 0) / f.length;
      const v = f.reduce((s, x) => s + (x - mean) ** 2, 0) / f.length;
      return agg === "varp" ? v : Math.sqrt(v);
    }
    case "sum":
    default:
      return nums.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
  }
}

/* ─── Mergeable accumulators ──────────────────────────────────────────────────
   To make deep pivots fast we compute a per-(col,value) accumulator ONCE at each
   LEAF and then ROLL UP bottom-up: a parent's accumulator is the O(children)
   merge of its children's accumulators — never a re-scan of all descendant leaves.
   Each aggregate keeps just enough SUFFICIENT STATISTICS to be exact after
   merging (sum keeps a running sum; count keeps n; average keeps {sum,n} over
   finite values; min/max keep the running extreme; countNumbers keeps the
   finite-count). This yields the SAME result as scanning the raw union of values
   (so average totals = avg of ALL underlying values, min/max ignore non-numbers),
   at ~O(rows × depth) instead of ~O(rows × depth × cols × values). */
interface Acc {
  sum: number; // Σ of finite values (for "sum" / "average").
  n: number; // total observations (for "count"/COUNTA).
  fn: number; // finite-value count (for "countNumbers"/COUNT / "average").
  min: number; // running min over finite values (Infinity if none seen).
  max: number; // running max over finite values (-Infinity if none seen).
  // Welford/Chan running moments over finite values (for STDEV/STDEVP/VAR/VARP). Stored as
  // {mean, M2} rather than Σx² because the naive Σx² − (Σx)²/n form suffers catastrophic
  // cancellation on large-magnitude data (e.g. currency ~1e8 with small variance → negative
  // variance / wrong stdev). Welford is exact-to-rounding and merges in O(1) via Chan's algorithm.
  mean: number; // running mean of finite values.
  m2: number; // running Σ(x − mean)² (the "M2" sum of squared deviations).
  prod: number; // Πx over finite values (for PRODUCT — mergeable; identity 1).
  vals?: number[]; // finite values, tracked ONLY when a value field uses MEDIAN.
  uniq?: Set<string>; // distinct non-empty raw values, ONLY when a field uses COUNTUNIQUE.
}
const newAcc = (needVals = false, needUniq = false): Acc => ({
  sum: 0,
  n: 0,
  fn: 0,
  min: Infinity,
  max: -Infinity,
  mean: 0,
  m2: 0,
  prod: 1,
  vals: needVals ? [] : undefined,
  uniq: needUniq ? new Set<string>() : undefined,
});

/** Fold one RAW value into an accumulator (keeps distinctness for COUNTUNIQUE + the
 *  value list for MEDIAN; everything else is O(1) sufficient statistics). */
/**
 * Coerce a cell value to a number for numeric aggregation. Imported .xlsx cells often
 * carry the DISPLAY string ("$196,282.09", "(1,234.50)", "45%") rather than a raw number,
 * and plain Number() returns NaN for those — which silently dropped them from SUM/AVG/etc.
 * (the "pivot shows 0 / no data" bug). Strip currency symbols + thousands separators, read
 * accounting-style "(n)" as negative, and honor a trailing "%".
 */
export function toNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return Number(raw);
  let s = raw.trim();
  if (s === "") return NaN;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) s = "-" + paren[1];
  const pct = s.endsWith("%");
  if (pct) s = s.slice(0, -1);
  s = s.replace(/[,$£€¥\s ]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (pct ? n / 100 : n) : NaN;
}

/**
 * Parse a date-like label to a sortable UTC timestamp, or NaN if it isn't a recognisable date.
 * Used so pivot row/column groups of dates sort CHRONOLOGICALLY (like Google Sheets) instead of
 * lexically ("01/01/2020" before "12/31/2019"). Handles ISO `YYYY-MM-DD` and US `MM/DD/YYYY`
 * (month validated ≤ 12 so a `DD/MM` value that isn't a valid MM/DD falls back to text sorting).
 */
export function toDate(raw: unknown): number {
  if (typeof raw !== "string") return NaN;
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]|$)/.exec(s); // ISO
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return Date.UTC(y, mo - 1, d);
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // US MM/DD/YYYY
  if (m) {
    const mo = +m[1];
    const d = +m[2];
    const y = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return Date.UTC(y, mo - 1, d);
  }
  return NaN;
}

/** Evaluate a Google-Sheets "Filter by condition" predicate against a raw cell value. */
export function matchesCondition(raw: unknown, cond: PivotFilterCondition): boolean {
  const empty = raw == null || String(raw).trim() === "";
  switch (cond.type) {
    case "isEmpty":
      return empty;
    case "isNotEmpty":
      return !empty;
    case "textContains":
      return String(raw ?? "").toLowerCase().includes(cond.value.toLowerCase());
    case "textNotContains":
      return !String(raw ?? "").toLowerCase().includes(cond.value.toLowerCase());
    case "textStartsWith":
      return String(raw ?? "").toLowerCase().startsWith(cond.value.toLowerCase());
    case "textEndsWith":
      return String(raw ?? "").toLowerCase().endsWith(cond.value.toLowerCase());
    case "textEq":
      return String(raw ?? "").toLowerCase() === cond.value.toLowerCase();
    default: {
      // Numeric conditions — compare via the same parser the SUM engine uses.
      const n = toNumber(raw);
      if (!Number.isFinite(n)) return false;
      switch (cond.type) {
        case "gt":
          return n > cond.value;
        case "gte":
          return n >= cond.value;
        case "lt":
          return n < cond.value;
        case "lte":
          return n <= cond.value;
        case "eq":
          return n === cond.value;
        case "neq":
          return n !== cond.value;
        case "between":
          return n >= cond.value && n <= cond.value2;
      }
    }
  }
}

export const PIVOT_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const PIVOT_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Apply a "Group by" rule to a raw value → the bucket LABEL (Google Sheets grouping).
 *  Dates bucket by calendar part; numbers into fixed intervals. "" when not applicable. */
/** Resolve a raw cell value to a UTC timestamp for date grouping. Handles the three shapes a
 *  date can arrive as: a `Date`, a NUMERIC Excel serial (days since 1899-12-30 — how Univer/xlsx
 *  store dates), or an ISO/US date STRING. NaN when not a recognisable date. */
export function toDateTs(raw: unknown): number {
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number" && Number.isFinite(raw)) return Date.UTC(1899, 11, 30) + raw * 86400000;
  return toDate(raw);
}

export function applyGroupRule(raw: unknown, rule: PivotGroupRule): string {
  if (rule.kind === "number") {
    const v = toNumber(raw);
    if (!Number.isFinite(v)) return "";
    const start = rule.start ?? 0;
    const size = rule.size > 0 ? rule.size : 1;
    const lo = start + Math.floor((v - start) / size) * size;
    return `${lo} – ${lo + size}`;
  }
  const ts = toDateTs(raw);
  if (!Number.isFinite(ts)) return "";
  const d = new Date(ts);
  switch (rule.part) {
    case "year":
      return String(d.getUTCFullYear());
    case "quarter":
      return "Q" + (Math.floor(d.getUTCMonth() / 3) + 1);
    case "month":
      return PIVOT_MONTHS[d.getUTCMonth()];
    case "yearMonth":
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    case "dayOfWeek":
      return PIVOT_DAYS[d.getUTCDay()];
    case "dayOfMonth":
      return String(d.getUTCDate());
    default:
      return "";
  }
}

/** Numeric ordinal for a grouped bucket label so calendar/interval buckets sort in natural order
 *  (Jan<Feb, Q1<Q2, 0–100<100–200) rather than lexically. undefined = use the normal comparator
 *  (year / yearMonth / dayOfMonth already sort correctly as numbers/fixed-width strings). */
export function groupOrdinal(rule: PivotGroupRule | undefined, label: string): number | undefined {
  if (!rule) return undefined;
  if (rule.kind === "number") {
    const lo = parseFloat(label);
    return Number.isFinite(lo) ? lo : undefined;
  }
  switch (rule.part) {
    case "month": {
      const i = PIVOT_MONTHS.indexOf(label);
      return i < 0 ? undefined : i;
    }
    case "dayOfWeek": {
      const i = PIVOT_DAYS.indexOf(label);
      return i < 0 ? undefined : i;
    }
    case "quarter":
      return label.startsWith("Q") ? Number(label.slice(1)) : undefined;
    default:
      return undefined;
  }
}

function pushAcc(a: Acc, raw: unknown): void {
  // COUNTA (a.n) counts NON-EMPTY values only, like Google Sheets — not raw row count. A truly
  // empty cell (null / blank string) does not increment the count.
  if (raw != null && String(raw).trim() !== "") a.n += 1;
  if (a.uniq && raw != null && String(raw).trim() !== "") a.uniq.add(String(raw));
  const x = toNumber(raw);
  if (Number.isFinite(x)) {
    a.sum += x;
    a.fn += 1;
    // Welford online moment update (stable variance).
    const delta = x - a.mean;
    a.mean += delta / a.fn;
    a.m2 += delta * (x - a.mean);
    a.prod *= x;
    if (x < a.min) a.min = x;
    if (x > a.max) a.max = x;
    a.vals?.push(x);
  }
}

/** Merge `src` INTO `dst` in O(1) (O(k) when tracking median/uniq) — associative +
 *  commutative, so roll-up order doesn't matter and a parent = merge of its children. */
function mergeAcc(dst: Acc, src: Acc): void {
  // Chan's parallel merge of the Welford moments — MUST run before dst.fn is updated, since it
  // uses the pre-merge counts (nA = dst.fn, nB = src.fn). Order-independent and exact-to-rounding.
  if (src.fn > 0) {
    if (dst.fn === 0) {
      dst.mean = src.mean;
      dst.m2 = src.m2;
    } else {
      const nA = dst.fn;
      const nB = src.fn;
      const nAB = nA + nB;
      const delta = src.mean - dst.mean;
      dst.mean += (delta * nB) / nAB;
      dst.m2 += src.m2 + (delta * delta * nA * nB) / nAB;
    }
  }
  dst.sum += src.sum;
  dst.n += src.n;
  dst.fn += src.fn;
  dst.prod *= src.prod;
  if (src.min < dst.min) dst.min = src.min;
  if (src.max > dst.max) dst.max = src.max;
  if (dst.vals && src.vals) for (const v of src.vals) dst.vals.push(v);
  if (dst.uniq && src.uniq) for (const u of src.uniq) dst.uniq.add(u);
}

/** Read the final aggregate out of an accumulator (matches `aggregate()` exactly). */
function readAcc(a: Acc, agg: PivotAggregate): number {
  switch (agg) {
    case "count":
      return a.n;
    case "countNumbers":
      return a.fn;
    case "countunique":
      return a.uniq ? a.uniq.size : 0;
    case "average":
      return a.fn ? a.sum / a.fn : 0;
    case "min":
      return a.fn ? a.min : 0;
    case "max":
      return a.fn ? a.max : 0;
    case "median": {
      if (!a.vals || !a.vals.length) return 0;
      const s = [...a.vals].sort((x, y) => x - y);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    case "product":
      return a.fn ? a.prod : 0;
    case "var":
    case "stdev": {
      if (a.fn < 2) return 0;
      const v = a.m2 / (a.fn - 1); // sample variance (Welford M2)
      return agg === "var" ? v : Math.sqrt(Math.max(0, v));
    }
    case "varp":
    case "stdevp": {
      if (a.fn < 1) return 0;
      const v = a.m2 / a.fn; // population variance (Welford M2)
      return agg === "varp" ? v : Math.sqrt(Math.max(0, v));
    }
    case "sum":
    default:
      return a.sum;
  }
}

/** Default header label for a value field, e.g. "Sum of Amount". */
export function valueLabel(v: PivotValueField): string {
  if (v.label) return v.label;
  if (v.aggregate === "custom") return v.field || "Calculated field";
  const verb: Record<PivotAggregate, string> = {
    sum: "Sum",
    count: "COUNTA",
    countNumbers: "COUNT",
    countunique: "COUNTUNIQUE",
    average: "Average",
    min: "Min",
    max: "Max",
    median: "Median",
    product: "Product",
    stdev: "STDEV",
    stdevp: "STDEVP",
    var: "VAR",
    varp: "VARP",
    custom: "Custom",
  };
  return `${verb[v.aggregate]} of ${v.field}`;
}

/** Compute the full pivot tree from a source + spec. */
export function computePivotModel(source: PivotSource, spec: PivotSpec): PivotModel {
  // Use ONLY the value fields the user configured. Previously an empty Values list
  // silently invented `count(fields[0])`, which manufactured a constant "Grand Total =
  // row-count" (e.g. 1000) that never reflected the layout — the source of the "pivot
  // shows data I didn't ask for / won't clear" bug. With no values the pivot shows just
  // the row/column labels (Google-Sheets behavior).
  // Inherit each value field's number format from the SOURCE column (currency/%/decimals) when
  // the value doesn't set its own — so a SUM of a "$" column renders as currency like Google
  // Sheets. Count aggregates are excluded (they're always integers, regardless of the source).
  const isCountAgg = (agg: PivotAggregate) => agg === "count" || agg === "countNumbers" || agg === "countunique";
  const values: PivotValueField[] = spec.values.map((v) => {
    const inherited = source.numFmt?.[v.field];
    return v.numFmt || !inherited || isCountAgg(v.aggregate) ? v : { ...v, numFmt: inherited };
  });

  // 1. Filter rows — "by values" (include list) AND/OR "by condition" predicate. Both run BEFORE
  // aggregation, so a filter changes totals (Google-Sheets semantics), not just visibility.
  const filters = spec.filters ?? [];
  const rows = source.rows.filter((r) =>
    filters.every((f) => {
      const raw = r[f.field];
      if (f.include && !f.include.includes(String(raw ?? ""))) return false;
      if (f.condition && !matchesCondition(raw, f.condition)) return false;
      return true;
    }),
  );

  const nValues = values.length;
  // MEDIAN needs the value multiset + COUNTUNIQUE the distinct set — track them per value
  // field ONLY when used, so the fast O(1) roll-up is unaffected for the common aggregates.
  const needVals = values.map((v) => v.aggregate === "median");
  const needUniq = values.map((v) => v.aggregate === "countunique");
  const mkGroup = (): Acc[] => {
    const g = new Array<Acc>(nValues);
    for (let vi = 0; vi < nValues; vi++) g[vi] = newAcc(needVals[vi], needUniq[vi]);
    return g;
  };
  // Cell key: `${colPath}${SEP}${vi}`. The row Total column uses a DEDICATED sentinel
  // colPath (ROW_TOTAL) that can never equal a real column path — including the ""
  // path produced by a column field whose VALUE is blank — so the two never collide.
  const cellKey = (colPath: string, vi: number) => `${colPath}${SEP}${vi}`;

  // 2. Per-LEAF accumulators, computed ONCE per row: rowLeafPath → colLeafPath →
  //    valueIndex → Acc (sufficient statistics). This is the single scan of the
  //    underlying data; everything above rolls these UP without re-scanning.
  //    An `AccGroup` is the array of accumulators for one (rowLeaf,colLeaf) cell.
  type AccGroup = Acc[]; // length nValues
  const rawAcc = new Map<string, Map<string, AccGroup>>();
  const rowLeafOrder: string[] = [];
  const colLeafSet = new Map<string, string[]>(); // colPath → the ordered key parts (for header tree)
  const seenRowLeaf = new Set<string>();

  const pathOf = (r: Record<string, unknown>, fields: string[]): { parts: string[]; path: string } => {
    const parts = fields.map((f) => {
      const rule = spec.dimSettings?.[f]?.groupRule;
      return rule ? applyGroupRule(r[f], rule) : String(r[f] ?? "");
    });
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
    let byCol = rawAcc.get(rl.path);
    if (!byCol) rawAcc.set(rl.path, (byCol = new Map()));
    let grp = byCol.get(cl.path);
    if (!grp) {
      grp = mkGroup();
      byCol.set(cl.path, grp);
    }
    for (let vi = 0; vi < nValues; vi++) pushAcc(grp[vi], r[values[vi].field]);
  }

  const colLeaves = [...colLeafSet.keys()];

  // Roll a rowLeaf's per-column groups into a single "row Total" (all columns
  // unioned) group — merging accumulators, so an average Total is the average of
  // ALL underlying values, NOT an average of per-column averages (Excel-exact).
  // Stored under the dedicated ROW_TOTAL colPath so it NEVER collides with a real
  // column path — including the "" path a blank column-field value produces (that
  // blank data must still be counted in the Total, which the old ""-keyed total
  // wrongly dropped). Always built; render decides whether to show the Total column.
  const rowTotalAcc = new Map<string, AccGroup>();
  for (const [rl, byCol] of rawAcc) {
    const tot: AccGroup = mkGroup();
    for (const grp of byCol.values()) for (let vi = 0; vi < nValues; vi++) mergeAcc(tot[vi], grp[vi]);
    rowTotalAcc.set(rl, tot);
  }

  // 3. Build the nested row tree from the ordered leaf paths.
  interface Build {
    key: string;
    path: string;
    level: number;
    children: Map<string, Build>;
    childOrder: string[];
    leaves: string[]; // rowLeafPaths directly at this node (only populated on true leaves)
    /** Rolled-up accumulators: colLeafPath → per-value Acc, plus "" = row Total. */
    acc: Map<string, AccGroup>;
  }
  const makeBuild = (key: string, path: string, level: number): Build => ({
    key,
    path,
    level,
    children: new Map(),
    childOrder: [],
    leaves: [],
    acc: new Map(),
  });
  const rootChildren = new Map<string, Build>();
  const rootOrder: string[] = [];
  for (const leaf of rowLeafOrder) {
    const parts = leaf.split(SEP);
    let map = rootChildren;
    let order = rootOrder;
    let prefix = "";
    let node: Build | undefined;
    for (let lvl = 0; lvl < parts.length; lvl++) {
      const key = parts[lvl];
      prefix = lvl === 0 ? key : `${prefix}${SEP}${key}`;
      node = map.get(key);
      if (!node) {
        node = makeBuild(key, prefix, lvl);
        map.set(key, node);
        order.push(key);
      }
      map = node.children;
      order = node.childOrder;
    }
    // `node` is now the true-leaf Build for this rowLeaf path.
    if (node) node.leaves.push(leaf);
  }

  // Merge one leaf's accumulators (per column + row Total) into a node's acc map.
  const ensureGroup = (m: Map<string, AccGroup>, colPath: string): AccGroup => {
    let g = m.get(colPath);
    if (!g) {
      g = mkGroup();
      m.set(colPath, g);
    }
    return g;
  };
  const mergeGroupInto = (dst: Map<string, AccGroup>, colPath: string, src: AccGroup): void => {
    const g = ensureGroup(dst, colPath);
    for (let vi = 0; vi < nValues; vi++) mergeAcc(g[vi], src[vi]);
  };

  // Bottom-up finalize: a parent's accumulators are the O(children) merge of its
  // children's — descendants are NEVER re-scanned.
  // "Order" (asc/desc) per dimension field — sort a node's children by their label.
  const cmp = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const sortOrderFor = (field: string | undefined): "asc" | "desc" | undefined => (field ? spec.dimSettings?.[field]?.order : undefined);
  // Numeric-aware label comparison: numeric values (incl. $/£/€ + accounting negatives, via
  // toNumber) sort by magnitude like Google Sheets; everything else uses the locale collator.
  const labelCompare = (a: string, b: string): number => {
    const na = toNumber(a);
    const nb = toNumber(b);
    // Numeric magnitude when both parse; on a numeric TIE (e.g. "001" vs "1") fall back to the
    // collator so textually-distinct-but-numerically-equal codes keep a stable, lexical order.
    if (Number.isFinite(na) && Number.isFinite(nb)) return na !== nb ? na - nb : cmp.compare(a, b);
    // Dates sort CHRONOLOGICALLY, not lexically (Google Sheets), when both parse as dates.
    const da = toDate(a);
    const db = toDate(b);
    if (Number.isFinite(da) && Number.isFinite(db)) return da !== db ? da - db : cmp.compare(a, b);
    return cmp.compare(a, b);
  };
  // Compare two group labels for a dimension field, honoring a group-by rule's natural ordinal
  // (month/quarter/day-of-week/number-bucket) before falling back to the numeric/date/text order.
  const dimCompare = (field: string | undefined, a: string, b: string): number => {
    const rule = field ? spec.dimSettings?.[field]?.groupRule : undefined;
    const oa = groupOrdinal(rule, a);
    const ob = groupOrdinal(rule, b);
    if (oa !== undefined && ob !== undefined) return oa - ob;
    return labelCompare(a, b);
  };
  const sortKeys = (keys: string[], field: string | undefined) => {
    // Google Sheets sorts pivot row/column groups ascending by default; "desc" flips it.
    // (Matches the panel's Order select, which shows "Ascending" when unset.)
    const dir = sortOrderFor(field) === "desc" ? -1 : 1;
    keys.sort((a, c) => dir * dimCompare(field, a, c));
  };
  // "Sort by": when a dimension's `sortBy` names a VALUE field (not its own label), the
  // sibling groups at that level are ordered by that value's aggregated total instead of by
  // label. The child PivotNodes must already be finalized (their ROW_TOTAL values populated).
  const valueSortIndex = (field: string | undefined): number => {
    if (!field) return -1;
    const sb = spec.dimSettings?.[field]?.sortBy;
    // `sortBy` is either undefined (→ sort by label, handled by sortKeys) or a VALUE field's
    // name — including the case where that value field is ALSO this dimension's field. So we
    // resolve it purely by looking it up in `values`; no `sb === field` short-circuit (that
    // would wrongly block sorting a dimension by its own aggregated total).
    if (!sb) return -1;
    return values.findIndex((v) => v.field === sb);
  };
  const applyValueSort = (children: PivotNode[], field: string | undefined): PivotNode[] => {
    const vi = valueSortIndex(field);
    if (vi < 0) return children;
    const ord = sortOrderFor(field) === "desc" ? -1 : 1;
    const totOf = (n: PivotNode) => (n.values.get(cellKey(ROW_TOTAL, vi)) ?? 0) as number;
    // Stable numeric sort by the chosen value's grand total for each group.
    return children
      .map((n, i) => ({ n, i }))
      .sort((a, b) => ord * (totOf(a.n) - totOf(b.n)) || a.i - b.i)
      .map((x) => x.n);
  };
  const finalize = (b: Build): PivotNode => {
    sortKeys(b.childOrder, spec.rows[b.level + 1]); // children are the NEXT row field
    const children = b.childOrder.map((k) => finalize(b.children.get(k)!));
    // Seed this node's accumulators from its own direct leaves (true leaves only).
    for (const leaf of b.leaves) {
      const byCol = rawAcc.get(leaf);
      if (byCol) for (const [col, grp] of byCol) mergeGroupInto(b.acc, col, grp);
      const tot = rowTotalAcc.get(leaf);      if (tot) mergeGroupInto(b.acc, ROW_TOTAL, tot);
    }
    // Merge each child's rolled-up accumulators upward.
    for (let i = 0; i < children.length; i++) {
      const cb = b.children.get(b.childOrder[i])!;
      for (const [col, grp] of cb.acc) mergeGroupInto(b.acc, col, grp);
    }
    // "Sort by": reorder these children by a value's total if this level's dim asks for it
    // (children are finalized here, so their ROW_TOTAL values exist). Falls back to the
    // label order established by sortKeys() above when sortBy is the field's own label.
    const orderedChildren = applyValueSort(children, spec.rows[b.level + 1]);
    const node: PivotNode = { key: b.key, path: b.path, level: b.level, children: orderedChildren, values: new Map() };
    for (const [col, grp] of b.acc) for (let vi = 0; vi < nValues; vi++) node.values.set(cellKey(col, vi), readAcc(grp[vi], values[vi].aggregate));
    // NOTE: data columns are intentionally NOT zero-filled — an intersection with no underlying
    // source rows stays ABSENT so the renderer leaves it BLANK (Google Sheets shows empty, not
    // 0.00, for sparse cross-tabs). Only the row-Total is guaranteed present (a real row group
    // always has ≥1 observation, so its total is a genuine number).
    for (let vi = 0; vi < nValues; vi++) { const k = cellKey(ROW_TOTAL, vi); if (!node.values.has(k)) node.values.set(k, aggregate([], values[vi].aggregate)); }
    return node;
  };
  sortKeys(rootOrder, spec.rows[0]); // top-level row groups (label order)
  const rootBuilds = rootOrder.map((k) => rootChildren.get(k)!);
  const rowTree = applyValueSort(rootBuilds.map((b) => finalize(b)), spec.rows[0]); // then Sort-by-value

  // 4. Grand totals (over ALL leaves) — merge every top-level node's accumulators.
  const grandAcc = new Map<string, AccGroup>();
  for (const b of rootBuilds) for (const [col, grp] of b.acc) mergeGroupInto(grandAcc, col, grp);
  const grand = new Map<string, number>();
  for (const [col, grp] of grandAcc) for (let vi = 0; vi < nValues; vi++) grand.set(cellKey(col, vi), readAcc(grp[vi], values[vi].aggregate));
  for (const col of colLeaves) for (let vi = 0; vi < nValues; vi++) { const k = cellKey(col, vi); if (!grand.has(k)) grand.set(k, aggregate([], values[vi].aggregate)); }
  for (let vi = 0; vi < nValues; vi++) { const k = cellKey(ROW_TOTAL, vi); if (!grand.has(k)) grand.set(k, aggregate([], values[vi].aggregate)); }

  // 6a. Column ORDER (Ascending/Descending) — sort the column leaves hierarchically, honoring
  // each column level's own Order (Google Sheets orders every axis independently). Without this
  // the columns followed raw data-appearance order and the Order control did nothing (the #37
  // bug). Numeric-aware so a numeric Columns field (e.g. Amount) sorts by value like Sheets.
  const colLabelCmp = (a: string, b: string): number => {
    const pa = a.split(SEP);
    const pb = b.split(SEP);
    const depth = Math.min(pa.length, pb.length);
    for (let lvl = 0; lvl < depth; lvl++) {
      if (pa[lvl] !== pb[lvl]) {
        const dir = sortOrderFor(spec.columns[lvl]) === "desc" ? -1 : 1;
        return dir * dimCompare(spec.columns[lvl], pa[lvl], pb[lvl]);
      }
    }
    return pa.length - pb.length;
  };
  let orderedColLeaves = [...colLeaves].sort(colLabelCmp);

  // 6b. Column "Sort by" (value-based): within each parent group, reorder the leaves by the
  // chosen value's grand total (the label order from 6a is the fallback / tie-break).
  const colDimField = spec.columns[spec.columns.length - 1];
  const colSortVi = valueSortIndex(colDimField);
  if (colSortVi >= 0 && orderedColLeaves.length > 1) {
    const ord = sortOrderFor(colDimField) === "desc" ? -1 : 1;
    const parentOf = (leaf: string) => { const i = leaf.lastIndexOf(SEP); return i < 0 ? "" : leaf.slice(0, i); };
    const totOf = (leaf: string) => (grand.get(cellKey(leaf, colSortVi)) ?? 0) as number;
    const groups: string[][] = [];
    const groupIdx = new Map<string, number>();
    for (const leaf of orderedColLeaves) {
      const p = parentOf(leaf);
      let gi = groupIdx.get(p);
      if (gi === undefined) { gi = groups.length; groupIdx.set(p, gi); groups.push([]); }
      groups[gi].push(leaf);
    }
    for (const g of groups) g.sort((a, b) => ord * (totOf(a) - totOf(b)));
    orderedColLeaves = groups.flat();
  }

  // 7. Column header tree (levels of the column fields).
  const colTree = buildColTree(orderedColLeaves);

  return { spec, rowTree, colLeaves: orderedColLeaves, colTree, grand, values };
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

// Placeholder scaffold shown for a brand-new / cleared pivot — mirrors Google Sheets, which
// draws "Columns" (B1), "Rows" (A2) and "Values" (B2) on the sheet so the empty pivot reads as
// a pivot-in-progress rather than a blank grid. Muted so it's clearly a placeholder, not data.
const SCAFFOLD_HEAD_STYLE: CellStyle = { bl: 1, bg: { rgb: "#EFF4FF" }, cl: { rgb: "#475467" } };
const SCAFFOLD_LABEL_STYLE: CellStyle = { bl: 1, cl: { rgb: "#98A2B3" }, bg: { rgb: "#F9FAFB" } };

/** Render a computed pivot model into a styled cell region. */
export function renderPivotModel(model: PivotModel): RenderedPivot {
  const { spec, colLeaves, values } = model;
  // A fully-empty pivot (no rows, columns, or values) renders the Google-Sheets placeholder
  // scaffold: "Columns" at B1, "Rows" at A2, "Values" at B2. This gives the user a visible
  // target on the sheet while they configure fields, instead of a disorienting blank grid.
  if (spec.rows.length === 0 && spec.columns.length === 0 && values.length === 0) {
    return {
      cells: {
        0: { 1: { v: "Columns", s: SCAFFOLD_HEAD_STYLE } },
        1: { 0: { v: "Rows", s: SCAFFOLD_LABEL_STYLE }, 1: { v: "Values", s: SCAFFOLD_LABEL_STYLE } },
      },
      rowCount: 2,
      columnCount: 2,
    };
  }
  const collapsed = new Set(spec.collapsed ?? []);
  const showRowSubtotals = spec.showRowSubtotals ?? spec.rows.length > 1;
  // Grand totals need at least one value to total. With rows/columns but no values the
  // pivot lists the distinct labels only (no numeric grand total), like Google Sheets.
  const showGrand = values.length === 0 ? { row: false, column: false } : (spec.showGrandTotals ?? { row: true, column: true });
  // Distinct column leaves to render. When a Columns FIELD is present, a blank column-field value
  // ("") is a real group Google Sheets shows as "(blank)" — so keep it. With NO columns field,
  // "" is just the single implicit column and carries no header, so drop it.
  const realCols = spec.columns.length > 0 ? colLeaves.slice() : colLeaves.filter((c) => c !== "");
  // Google Sheets shows an empty group key (row or column) as the literal "(blank)".
  const BLANK_LABEL = "(blank)";
  const showKey = (k: string) => (k === "" ? BLANK_LABEL : k);
  // Count aggregates render as integers (no decimals), like Google Sheets; other aggregates keep
  // the source/number pattern.
  const isCount = (agg: PivotAggregate) => agg === "count" || agg === "countNumbers" || agg === "countunique";
  const patternFor = (v: PivotValueField) => v.numFmt ?? (isCount(v.aggregate) ? "#,##0" : NUMBER_PATTERN);

  const cells: Record<number, Record<number, Cell>> = {};
  const set = (r: number, c: number, cell: Cell) => {
    (cells[r] ??= {})[c] = cell;
  };

  // Column geometry: col 0 = row labels; then (realCols × values); then value Totals (if showGrand.column).
  // `perCol` = column-slots per distinct COLUMN value. With no values we still give each column
  // ONE slot so a Columns field lays out its labels (Google Sheets shows the distinct column
  // values as headers even before a Value is added) instead of collapsing to nothing.
  const nValues = values.length;
  const perCol = nValues || 1;
  const dataStart = 1;
  const totalStart = dataStart + realCols.length * perCol;
  const columnCount = totalStart + (showGrand.column ? nValues : 0);

  // Header rows — Google-Sheets layout. When a Columns field is present the header reads:
  //   row 0: the COLUMN FIELD NAME(s) (e.g. "Amount") — so you see WHAT is spread across the top,
  //   row 1: the distinct column VALUES (+ "Grand Total"), with the ROW field name in the corner,
  //   row 2 (ONLY when >1 value): the value NAMES under each column value so measures are labelled.
  // Previously row 0 and row 1 BOTH showed the column value (a duplicate) — a numeric Columns
  // field made "both rows numbers" with no field-name label. With NO columns, a single header row
  // labels the value column(s) with the value name ("Sum of Amount"), like Google Sheets.
  const colDepth = spec.columns.length;
  let headerRows = 0;
  const cellKey = (colPath: string, vi: number) => `${colPath}${SEP}${vi}`;

  if (colDepth > 0) {
    // Row 0 — column field name(s), spanning the whole data band (blank-filled, label at the start).
    const nameRow = headerRows;
    for (let c = 0; c < columnCount; c++) set(nameRow, c, { v: "", s: HEADER_STYLE });
    set(nameRow, dataStart, { v: spec.columns.join(" / "), s: HEADER_STYLE });
    headerRows++;

    // One value-header row PER column level — a TIERED header (Google Sheets). Each level shows its
    // distinct values; a parent label is written once at the start of its span (blanks across the
    // rest) so nested columns read as "Journal | Invoice" over "High | Low", not "Journal / High".
    // For a SINGLE column level this collapses to exactly one row (the previous behavior).
    for (let lvl = 0; lvl < colDepth; lvl++) {
      const hrLvl = headerRows;
      // The row field name sits in the corner of the LAST level row (adjacent to the data).
      set(hrLvl, 0, { v: lvl === colDepth - 1 ? spec.rows.join(" / ") || "" : "", s: HEADER_STYLE });
      let prevPrefix: string | null = null;
      realCols.forEach((col, ci) => {
        const parts = col.split(SEP);
        const prefix = parts.slice(0, lvl + 1).join(SEP);
        for (let vi = 0; vi < perCol; vi++) set(hrLvl, dataStart + ci * perCol + vi, { v: "", s: HEADER_STYLE });
        if (prefix !== prevPrefix) {
          set(hrLvl, dataStart + ci * perCol, { v: showKey(parts[lvl]), s: HEADER_STYLE });
          prevPrefix = prefix;
        }
      });
      // "Grand Total" spans the value columns on the FIRST level row only.
      if (showGrand.column) {
        for (let vi = 0; vi < nValues; vi++) set(hrLvl, totalStart + vi, { v: "", s: HEADER_STYLE });
        if (lvl === 0) set(hrLvl, totalStart, { v: "Grand Total", s: HEADER_STYLE });
      }
      headerRows++;
    }

    // Row 2 — value names under each column value (only when there is more than one value).
    if (nValues > 1) {
      const measRow = headerRows;
      set(measRow, 0, { v: "", s: HEADER_STYLE });
      realCols.forEach((_col, ci) => values.forEach((v, vi) => set(measRow, dataStart + ci * perCol + vi, { v: valueLabel(v), s: HEADER_STYLE })));
      if (showGrand.column) values.forEach((v, vi) => set(measRow, totalStart + vi, { v: valueLabel(v), s: HEADER_STYLE }));
      headerRows++;
    }
  } else {
    // No Columns field — a single header row: row field name in the corner, then the value name(s)
    // as the column header(s) (Google Sheets shows "SUM of Amount" here, not "Grand Total").
    const hr = headerRows;
    set(hr, 0, { v: spec.rows.join(" / ") || "", s: HEADER_STYLE });
    values.forEach((v, vi) => set(hr, totalStart + vi, { v: valueLabel(v), s: HEADER_STYLE }));
    headerRows++;
  }

  // Body rows: walk the row tree depth-first, emitting a row per node (+ subtotal when it has children).
  let r = headerRows;
  // "Show as": re-express a raw cell as a % of its row/column/grand/parent total, or a running
  // total accumulated down the rows. Running total keeps per-(column) state across the walk.
  const PCT_PATTERN = "0.0%";
  const RANK_PATTERN = "#,##0"; // ranks are integers
  const INDEX_PATTERN = "0.00"; // index is a unit-less ratio
  const runningTotals = new Map<string, number>();
  // Sum a value across every leaf column under a (possibly non-leaf) column PATH, read from a given
  // value source (a node's per-column values, OR the grand map). These maps only carry LEAF-column +
  // ROW_TOTAL keys, so a nested parent column ("X") is the Σ of its leaf descendants ("X␟A", …).
  const sumForColPath = (src: Map<string, number>, colPath: string, vi: number): number => {
    const direct = src.get(cellKey(colPath, vi));
    if (direct !== undefined) return direct; // leaf column or ROW_TOTAL — a real key
    let s = 0;
    for (const leaf of realCols) if (leaf === colPath || leaf.startsWith(colPath + SEP)) s += src.get(cellKey(leaf, vi)) ?? 0;
    return s;
  };
  const grandForColPath = (colPath: string, vi: number): number => sumForColPath(model.grand, colPath, vi);
  // Calculated fields: map a value-field NAME → its index (non-custom only, so a formula can't
  // reference another custom field). `cellValueOf` returns a cell's value — for a custom field it
  // evaluates the formula by substituting the referenced value fields' aggregates at the same
  // intersection; undefined (blank) when no referenced measure is present or the formula errors.
  // Defined BEFORE the rank precompute so ranks over a calculated field use its EVALUATED value.
  const valueVi = new Map<string, number>();
  values.forEach((v, vi) => {
    if (v.aggregate !== "custom" && !valueVi.has(v.field)) valueVi.set(v.field, vi);
  });
  const cellValueOf = (node: PivotNode | null, colPath: string, vi: number): number | undefined => {
    const v = values[vi];
    const src = node ? node.values : model.grand;
    if (v.aggregate !== "custom") return src.get(cellKey(colPath, vi));
    if (!v.formula) return undefined;
    let anyRef = false;
    const out = evalFormula(v.formula, (name) => {
      const rvi = valueVi.get(name);
      if (rvi === undefined) return undefined;
      const rv = src.get(cellKey(colPath, rvi));
      if (rv !== undefined) anyRef = true;
      return rv;
    });
    return anyRef && Number.isFinite(out) ? out : undefined;
  };
  // "Rank smallest→largest / largest→smallest": rank the LEAF row groups by a value within each
  // column slot, SCOPED PER PARENT row-group (Excel/Sheets rank the innermost items within each
  // parent, not globally). Competition ranking — tied values share a rank. Values come through
  // cellValueOf so a calculated field ranks by its evaluated result. Precomputed once because a
  // rank is relative to every sibling leaf, not derivable from one cell alone.
  const rankMap = new Map<string, number>(); // `${colPath}${SEP}${vi}${SEP}${nodePath}` → rank
  if (values.some((v) => v.showAs === "rankAsc" || v.showAs === "rankDesc")) {
    const groups = new Map<string, PivotNode[]>(); // parentPath → its leaf nodes
    const collectLeaves = (nodes: PivotNode[]) => {
      for (const n of nodes) {
        if (n.children.length === 0 || collapsed.has(n.path)) {
          const i = n.path.lastIndexOf(SEP);
          const pk = i < 0 ? "" : n.path.slice(0, i);
          let g = groups.get(pk);
          if (!g) groups.set(pk, (g = []));
          g.push(n);
        } else collectLeaves(n.children);
      }
    };
    collectLeaves(model.rowTree);
    const colSlots = [...realCols, ROW_TOTAL];
    values.forEach((v, vi) => {
      const asc = v.showAs === "rankAsc";
      if (!asc && v.showAs !== "rankDesc") return;
      for (const col of colSlots) {
        for (const grp of groups.values()) {
          const entries = grp
            .map((n) => ({ path: n.path, val: cellValueOf(n, col, vi) }))
            .filter((e): e is { path: string; val: number } => e.val !== undefined);
          for (const e of entries) {
            const better = entries.filter((o) => (asc ? o.val < e.val : o.val > e.val)).length;
            rankMap.set(`${col}${SEP}${vi}${SEP}${e.path}`, better + 1);
          }
        }
      }
    });
  }
  const showAsCell = (raw: number | undefined, colPath: string, vi: number, node: PivotNode | null, parent: PivotNode | null | undefined, accumulate: boolean): { v: number | ""; pattern: string } => {
    const mode = values[vi].showAs ?? "default";
    const base = patternFor(values[vi]);
    if (mode === "default" || raw == null) return { v: raw ?? 0, pattern: base };
    if (mode === "runningTotal" || mode === "pctRunningTotal") {
      // Cumulative sum down the (leaf) rows for this column slot; group/subtotal rows peek without
      // adding (so a subtotal doesn't double-count its children). "% running total" divides the
      // cumulative by the column's grand total, so the last leaf reads 100%.
      const k = cellKey(colPath, vi);
      const cur = runningTotals.get(k) ?? 0;
      const val = accumulate ? cur + raw : cur;
      if (accumulate) runningTotals.set(k, val);
      if (mode === "pctRunningTotal") {
        const colGrand = grandForColPath(colPath, vi);
        return { v: colGrand ? val / colGrand : 0, pattern: PCT_PATTERN };
      }
      return { v: val, pattern: base };
    }
    if (mode === "rankAsc" || mode === "rankDesc") {
      const rk = node ? rankMap.get(`${colPath}${SEP}${vi}${SEP}${node.path}`) : undefined;
      if (rk !== undefined) return { v: rk, pattern: RANK_PATTERN };
      // Subtotal / grand-total rows carry no rank — Google Sheets leaves those cells BLANK.
      return { v: "", pattern: base };
    }
    const rowTot = (node ? node.values.get(cellKey(ROW_TOTAL, vi)) : model.grand.get(cellKey(ROW_TOTAL, vi))) ?? 0;
    const colTot = grandForColPath(colPath, vi);
    const grandTot = model.grand.get(cellKey(ROW_TOTAL, vi)) ?? 0;
    if (mode === "index") {
      // Google-Sheets "Index" = (cell × grand) / (rowTotal × colTotal) — a relative-weight measure.
      const den = rowTot * colTot;
      return { v: den ? (raw * grandTot) / den : 0, pattern: INDEX_PATTERN };
    }
    // "% of parent row" = value / the PARENT row-group's total IN THE SAME COLUMN (so sibling rows
    // under a parent sum to 100% within each column). "% of parent column" = value / the PARENT
    // column-group's total IN THE SAME ROW. At the top level the parent is the grand total for that
    // same column / row (NOT the all-axes grand total).
    const parentTot = (parent ? parent.values.get(cellKey(colPath, vi)) : model.grand.get(cellKey(colPath, vi))) ?? 0;
    const parentColPath = colPath === ROW_TOTAL ? ROW_TOTAL : (() => { const i = colPath.lastIndexOf(SEP); return i < 0 ? ROW_TOTAL : colPath.slice(0, i); })();
    const parentColTot = sumForColPath(node ? node.values : model.grand, parentColPath, vi);
    const den = mode === "pctOfRow" ? rowTot : mode === "pctOfCol" ? colTot : mode === "pctOfParentRow" ? parentTot : mode === "pctOfParentCol" ? parentColTot : grandTot;
    return { v: den ? raw / den : 0, pattern: PCT_PATTERN };
  };
  // `accumulate` controls whether a "running total" cell adds to its column's running sum (true
  // for leaf data rows) or just peeks the current cumulative (group headers / subtotals / grand).
  const emitValueCells = (row: number, node: PivotNode | null, total: boolean, parent?: PivotNode | null, accumulate = true) => {
    realCols.forEach((col, ci) => {
      values.forEach((_v, vi) => {
        const raw = cellValueOf(node, col, vi);
        const slot = dataStart + ci * perCol + vi;
        // Absent intersection (no source rows) → BLANK, like Google Sheets (not 0.00). A genuine
        // aggregate of 0 (e.g. SUM of a $0.00 column that HAS rows) is present, so it still shows.
        if (raw === undefined) {
          set(row, slot, { v: "", s: total ? TOTAL_LABEL_STYLE : undefined });
          return;
        }
        const { v: out, pattern } = showAsCell(raw, col, vi, node, parent, accumulate);
        // A Show-as blank (e.g. rank on a subtotal row) renders as an empty styled cell, not 0.
        set(row, slot, out === "" ? { v: "", s: total ? TOTAL_LABEL_STYLE : undefined } : { v: out, s: numStyle(pattern, total) });
      });
    });
    if (showGrand.column) {
      values.forEach((_v, vi) => {
        const raw = cellValueOf(node, ROW_TOTAL, vi);
        if (raw === undefined) {
          set(row, totalStart + vi, { v: "", s: TOTAL_LABEL_STYLE });
          return;
        }
        // Apply Show-as to the row-Total column too (for a NO-columns pivot this IS the value
        // column). Running total accumulates its own down-the-rows sum here (keyed by ROW_TOTAL).
        const { v: out, pattern } = showAsCell(raw, ROW_TOTAL, vi, node, parent, accumulate);
        set(row, totalStart + vi, out === "" ? { v: "", s: TOTAL_LABEL_STYLE } : { v: out, s: numStyle(pattern, true) });
      });
    }
  };

  const walk = (nodes: PivotNode[], parent: PivotNode | null = null) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed.has(node.path);
      const isLeaf = !hasChildren || isCollapsed;
      const chevron = hasChildren ? (isCollapsed ? "▸ " : "▾ ") : "";
      // Group header / leaf row. Only LEAF rows accumulate a running total.
      set(r, 0, { v: `${chevron}${showKey(node.key)}`, s: indentStyle(node.level, hasChildren ? { bl: 1 } : undefined) });
      emitValueCells(r, node, false, parent, isLeaf);
      r++;
      if (hasChildren && !isCollapsed) {
        walk(node.children, node);
        // Per-level "Show totals" (dimSettings), falling back to the global default.
        const showThisTotal = spec.dimSettings?.[spec.rows[node.level]]?.showTotals ?? showRowSubtotals;
        if (showThisTotal) {
          set(r, 0, { v: `${showKey(node.key)} Total`, s: indentStyle(node.level, TOTAL_LABEL_STYLE) });
          emitValueCells(r, node, true, parent, false);
          r++;
        }
      }
    }
  };
  // With no Row field, the row tree is a single synthetic empty-key node — Google Sheets renders
  // no body in that case, just the column headers and a Grand Total row. So only walk when there
  // is at least one row field.
  if (spec.rows.length > 0) walk(model.rowTree);

  // Grand-total row.
  if (showGrand.row) {
    set(r, 0, { v: "Grand Total", s: TOTAL_LABEL_STYLE });
    emitValueCells(r, null, true, null, false);
    r++;
  }

  return { cells, rowCount: r, columnCount };
}
