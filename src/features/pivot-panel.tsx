/**
 * <PivotPanel> — an Excel / Google-Sheets-style "PivotTable Fields" drawer.
 *
 * A right-hand pane listing the source fields (searchable, draggable chips) and
 * four drop areas — Filters · Columns · Rows · Values — into which fields are
 * arranged. Dragging uses native HTML5 drag-and-drop (no new dependency). A chip
 * in the Values area carries an aggregation dropdown (Sum/Count/…). Every edit
 * fires `onChange(spec)`.
 *
 * The panel is a thin, controlled view over a `PivotSpec`: all spec transforms
 * live in the exported pure helpers below (unit-testable without a DOM), and the
 * component just wires drag events → those helpers → `onChange`.
 *
 * Styling uses the host's Untitled UI design tokens (CSS custom properties from
 * theme.css, resolved because the panel renders inside the host DOM) via the `T`
 * map below — so buttons/borders/text are on-brand (fiab-yellow) and theme-aware.
 */
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ChevronDown, Plus, X } from "@untitledui/icons";
import type { PivotAggregate, PivotDimSetting, PivotFilterCondition, PivotGroupRule, PivotShowAs, PivotSpec, PivotValueField } from "../core/types";
import { valueLabel } from "./pivot-model";

/* ─── Spec model (pure, testable) ─────────────────────────────────────────── */

/** The four drop areas a field can live in. */
export type PivotArea = "filters" | "columns" | "rows" | "values";

export const PIVOT_AREAS: Array<{ key: PivotArea; label: string }> = [
  { key: "filters", label: "Filters" },
  { key: "columns", label: "Columns" },
  { key: "rows", label: "Rows" },
  { key: "values", label: "Values" },
];

/** The 13 Google-Sheets "Summarise by" functions (internal aggregate ← Google label). */
export const PIVOT_AGGREGATES: Array<{ value: PivotAggregate; label: string }> = [
  { value: "sum", label: "SUM" },
  { value: "count", label: "COUNTA" },
  { value: "countNumbers", label: "COUNT" },
  { value: "countunique", label: "COUNTUNIQUE" },
  { value: "average", label: "AVERAGE" },
  { value: "max", label: "MAX" },
  { value: "min", label: "MIN" },
  { value: "median", label: "MEDIAN" },
  { value: "product", label: "PRODUCT" },
  { value: "stdev", label: "STDEV" },
  { value: "stdevp", label: "STDEVP" },
  { value: "var", label: "VAR" },
  { value: "varp", label: "VARP" },
  { value: "custom", label: "Custom formula" },
];

/** "Filter by condition" options (Google Sheets). Numeric types parse the value; "between" needs
 *  a second value; isEmpty/isNotEmpty need none. */
type CondType = PivotFilterCondition["type"] | "none";
const FILTER_COND_OPTS: Array<{ value: CondType; label: string }> = [
  { value: "none", label: "None" },
  { value: "isNotEmpty", label: "Is not empty" },
  { value: "isEmpty", label: "Is empty" },
  { value: "textContains", label: "Text contains" },
  { value: "textNotContains", label: "Text does not contain" },
  { value: "textStartsWith", label: "Text starts with" },
  { value: "textEndsWith", label: "Text ends with" },
  { value: "textEq", label: "Text is exactly" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "eq", label: "Is equal to" },
  { value: "neq", label: "Is not equal to" },
  { value: "between", label: "Is between" },
  { value: "dateBefore", label: "Date is before" },
  { value: "dateAfter", label: "Date is after" },
  { value: "dateOn", label: "Date is" },
  { value: "dateBetween", label: "Date is between" },
  { value: "dateRelative", label: "Date is within" },
];
const COND_NUMERIC = new Set<CondType>(["gt", "gte", "lt", "lte", "eq", "neq", "between"]);
const COND_DATE = new Set<CondType>(["dateBefore", "dateAfter", "dateOn", "dateBetween"]); // ISO date input(s)
const COND_NO_VALUE = new Set<CondType>(["none", "isEmpty", "isNotEmpty"]);
/** Relative-date window options (Google Sheets "Date is within"). */
const PIVOT_DATE_RELATIVE_OPTS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Past 7 days" },
  { value: "last30", label: "Past 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "thisYear", label: "This year" },
] as const;
/** Build a condition object from the type + value input(s). */
function buildCondition(type: CondType, v1: string, v2: string): PivotFilterCondition | null {
  if (type === "none") return null;
  if (type === "isEmpty" || type === "isNotEmpty") return { type };
  if (COND_NUMERIC.has(type)) {
    const n = Number(v1);
    if (!Number.isFinite(n)) return { type: "isNotEmpty" }; // placeholder until a valid number is typed
    if (type === "between") return { type: "between", value: n, value2: Number.isFinite(Number(v2)) ? Number(v2) : n };
    return { type, value: n } as PivotFilterCondition;
  }
  if (type === "dateRelative") return { type: "dateRelative", value: (v1 || "today") as Extract<PivotFilterCondition, { type: "dateRelative" }>["value"] };
  if (COND_DATE.has(type)) {
    if (type === "dateBetween") return { type: "dateBetween", value: v1, value2: v2 };
    return { type, value: v1 } as PivotFilterCondition;
  }
  return { type, value: v1 } as PivotFilterCondition;
}

/** "Show as" options (Google Sheets). */
export const PIVOT_SHOW_AS: Array<{ value: PivotShowAs; label: string }> = [
  { value: "default", label: "Default" },
  { value: "pctOfRow", label: "% of row" },
  { value: "pctOfCol", label: "% of column" },
  { value: "pctOfGrand", label: "% of grand total" },
  { value: "pctOfParentRow", label: "% of parent row" },
  { value: "pctOfParentCol", label: "% of parent column" },
  { value: "runningTotal", label: "Running total" },
  { value: "pctRunningTotal", label: "% of running total" },
  { value: "rankAsc", label: "Rank smallest to largest" },
  { value: "rankDesc", label: "Rank largest to smallest" },
  { value: "index", label: "Index" },
];

/** Order options for Rows/Columns. */
const ORDER_OPTS: Array<{ value: "asc" | "desc"; label: string }> = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

/** "Group by" options for a Rows/Columns field (Google-Sheets grouping). The value is a token
 *  encoding the group rule; "none" = ungrouped, "number" = numeric interval buckets. */
type GroupOpt = "none" | "year" | "quarter" | "month" | "yearMonth" | "dayOfWeek" | "dayOfMonth" | "number";
const GROUP_OPTS: Array<{ value: GroupOpt; label: string }> = [
  { value: "none", label: "No grouping" },
  { value: "year", label: "Year" },
  { value: "quarter", label: "Quarter" },
  { value: "month", label: "Month" },
  { value: "yearMonth", label: "Year-Month" },
  { value: "dayOfWeek", label: "Day of week" },
  { value: "dayOfMonth", label: "Day of month" },
  { value: "number", label: "Numeric buckets" },
];
/** Read the current groupRule back into a GROUP_OPTS token. */
function groupOptOf(rule: PivotGroupRule | undefined): GroupOpt {
  if (!rule) return "none";
  return rule.kind === "number" ? "number" : rule.part;
}
/** Build a groupRule from a GROUP_OPTS token (default numeric bucket size = 100). */
function groupRuleFor(opt: GroupOpt, prevSize?: number): PivotGroupRule | undefined {
  if (opt === "none") return undefined;
  if (opt === "number") return { kind: "number", size: prevSize && prevSize > 0 ? prevSize : 100 };
  return { kind: "date", part: opt };
}

/** Sentinel for the Sort-by "sort by this field's own labels" choice. Must be distinct from
 *  any real field name — otherwise, when a field is BOTH a dimension and a value (e.g. group
 *  by Amount AND sum Amount), the "by label" option and the value option collide on the same
 *  value, making it impossible to sort the dimension by its own aggregated total. `sortBy` is
 *  stored as `undefined` for this choice; a real field name always means "sort by that value". */
const SORT_BY_LABEL = " __label__";

/** The ordered field names in a given area (values → their `field`). */
export function fieldsInArea(spec: PivotSpec, area: PivotArea): string[] {
  switch (area) {
    case "filters":
      return (spec.filters ?? []).map((f) => f.field);
    case "columns":
      return spec.columns;
    case "rows":
      return spec.rows;
    case "values":
      return spec.values.map((v) => v.field);
  }
}

/** Which area a field currently belongs to (first match), or null if unplaced. */
export function areaOfField(spec: PivotSpec, field: string): PivotArea | null {
  for (const { key } of PIVOT_AREAS) {
    if (fieldsInArea(spec, key).includes(field)) return key;
  }
  return null;
}

/** Remove a field from EVERY area (used by "Clear field" / legacy callers). */
export function removeField(spec: PivotSpec, field: string): PivotSpec {
  return {
    ...spec,
    rows: spec.rows.filter((f) => f !== field),
    columns: spec.columns.filter((f) => f !== field),
    values: spec.values.filter((v) => v.field !== field),
    filters: (spec.filters ?? []).filter((f) => f.field !== field),
  };
}

/** Remove a field from ONE area only. Used by the chip ✕ (so a field that lives in
 *  both Rows and Values loses only the one you dismiss) and by move-between-areas. */
export function removeFromArea(spec: PivotSpec, field: string, area: PivotArea): PivotSpec {
  switch (area) {
    case "rows":
      return { ...spec, rows: spec.rows.filter((f) => f !== field) };
    case "columns":
      return { ...spec, columns: spec.columns.filter((f) => f !== field) };
    case "values":
      return { ...spec, values: spec.values.filter((v) => v.field !== field) };
    case "filters":
      return { ...spec, filters: (spec.filters ?? []).filter((f) => f.field !== field) };
  }
}

/**
 * Insert `field` into `area` at `index` (append when index is undefined / out of range).
 *
 * Google-Sheets semantics — a field can live in MULTIPLE areas at once (e.g. Amount grouped
 * in Rows AND summed in Values), so placing does NOT wipe it from everywhere:
 *  - Rows and Columns are mutually exclusive (a field is a row OR a column, never both).
 *  - The target area is de-duped (dropping a chip onto its own area = reorder, not duplicate).
 *  - `moveFrom` is set only when the drag ORIGINATED from another section chip → that's a MOVE,
 *    so the source area is vacated. Dragging from the fields list (moveFrom undefined) is an ADD
 *    that leaves the field wherever else it already sits — this is what lets you reuse a field.
 * When placing into Values, an existing `PivotValueField` (its aggregate) is preserved.
 */
export function placeField(spec: PivotSpec, field: string, area: PivotArea, index?: number, moveFrom?: PivotArea, valueAggregate?: PivotAggregate): PivotSpec {
  const existingValue = spec.values.find((v) => v.field === field);
  let next = spec;
  if (area === "rows") next = removeFromArea(next, field, "columns");
  else if (area === "columns") next = removeFromArea(next, field, "rows");
  next = removeFromArea(next, field, area); // de-dupe within the target
  if (moveFrom && moveFrom !== area) next = removeFromArea(next, field, moveFrom); // MOVE: vacate source
  const at = (arr: unknown[]): number => (index === undefined || index < 0 || index > arr.length ? arr.length : index);

  switch (area) {
    case "rows": {
      const rows = [...next.rows];
      rows.splice(at(rows), 0, field);
      return { ...next, rows };
    }
    case "columns": {
      const columns = [...next.columns];
      columns.splice(at(columns), 0, field);
      return { ...next, columns };
    }
    case "filters": {
      const filters = [...(next.filters ?? [])];
      filters.splice(at(filters), 0, { field });
      return { ...next, filters };
    }
    case "values": {
      const values = [...next.values];
      // Preserve a moved value's aggregate; otherwise use the caller's type-detected default
      // (SUM for numeric, COUNTA for text — Google Sheets), falling back to "sum".
      const vf: PivotValueField = existingValue ?? { field, aggregate: valueAggregate ?? "sum" };
      values.splice(at(values), 0, vf);
      return { ...next, values };
    }
  }
}

/** Reset a spec to an empty pivot (the "Clear all" action). */
export function clearAll(spec: PivotSpec): PivotSpec {
  return { ...spec, rows: [], columns: [], values: [], filters: [], dimSettings: {}, collapsed: [], grandTotalLabel: undefined, blankRowBetweenGroups: false, centerGroupLabels: false };
}

/** Set the custom grand-total label (empty → default "Grand Total"). */
export function setGrandTotalLabel(spec: PivotSpec, label: string): PivotSpec {
  return { ...spec, grandTotalLabel: label.trim() ? label : undefined };
}

/** Toggle a boolean layout option (blank-row separator / center group labels). */
export function setPivotLayoutOption(spec: PivotSpec, patch: Partial<Pick<PivotSpec, "blankRowBetweenGroups" | "centerGroupLabels">>): PivotSpec {
  return { ...spec, ...patch };
}

/** "Values" pseudo-field placement options. */
export const VALUES_AXIS_OPTS: Array<{ value: "columns" | "rows"; label: string }> = [
  { value: "columns", label: "Columns" },
  { value: "rows", label: "Rows" },
];
export function valuesAxisOf(spec: PivotSpec): "columns" | "rows" {
  return spec.valuesAxis ?? "columns";
}
export function setValuesAxis(spec: PivotSpec, axis: "columns" | "rows"): PivotSpec {
  return { ...spec, valuesAxis: axis };
}

/** Collapse every row-group (Google Sheets "Collapse all"). `paths` = all collapsible node paths. */
export function collapseAll(spec: PivotSpec, paths: string[]): PivotSpec {
  return { ...spec, collapsed: [...new Set(paths)] };
}

/** Expand every row-group (clear the collapsed set). */
export function expandAll(spec: PivotSpec): PivotSpec {
  return { ...spec, collapsed: [] };
}

/** Change the aggregation of a value field. */
export function setValueAggregate(spec: PivotSpec, field: string, aggregate: PivotAggregate): PivotSpec {
  return {
    ...spec,
    values: spec.values.map((v) => (v.field === field ? { ...v, aggregate } : v)),
  };
}

/** The aggregate currently applied to a value field (for the dropdown). */
export function aggregateOfValue(spec: PivotSpec, field: string): PivotAggregate {
  return spec.values.find((v) => v.field === field)?.aggregate ?? "sum";
}

/** Change the "Show as" mode of a value field. */
export function setValueShowAs(spec: PivotSpec, field: string, showAs: PivotShowAs): PivotSpec {
  return { ...spec, values: spec.values.map((v) => (v.field === field ? { ...v, showAs } : v)) };
}
/** Set (or clear, with undefined) a value field's number-format pattern. */
export function setValueNumFmt(spec: PivotSpec, field: string, numFmt: string | undefined): PivotSpec {
  return { ...spec, values: spec.values.map((v) => (v.field === field ? { ...v, numFmt } : v)) };
}
/** Set a calculated (custom-formula) value field's formula. */
export function setValueFormula(spec: PivotSpec, field: string, formula: string): PivotSpec {
  return { ...spec, values: spec.values.map((v) => (v.field === field ? { ...v, formula } : v)) };
}

/** Number-format presets for a value field (token → Univer number pattern). "auto" = inherit the
 *  source column format / aggregate default. */
export const VALUE_NUMFMT_OPTS: Array<{ value: string; label: string; pattern?: string }> = [
  { value: "auto", label: "Automatic" },
  { value: "number", label: "Number (1,234.56)", pattern: "#,##0.00" },
  { value: "integer", label: "Integer (1,234)", pattern: "#,##0" },
  { value: "currency", label: "Currency ($1,234.56)", pattern: '"$"#,##0.00' },
  { value: "percent", label: "Percent (12.3%)", pattern: "0.0%" },
  { value: "thousands", label: "Number (1234.56)", pattern: "0.00" },
];
/** Reverse-map a stored pattern back to a preset token (for the Select's current value). */
export function numFmtTokenOf(pattern: string | undefined): string {
  if (!pattern) return "auto";
  return VALUE_NUMFMT_OPTS.find((o) => o.pattern === pattern)?.value ?? "auto";
}

/** Patch a Rows/Columns field's per-field settings (Order / Show totals), keyed by field. */
export function setDimSetting(spec: PivotSpec, field: string, patch: Partial<PivotDimSetting>): PivotSpec {
  const prev = spec.dimSettings ?? {};
  return { ...spec, dimSettings: { ...prev, [field]: { ...prev[field], ...patch } } };
}
export function dimSettingOf(spec: PivotSpec, field: string): PivotDimSetting {
  return spec.dimSettings?.[field] ?? {};
}

/** Set the kept values ("Filter by values") for a filter field. `null`/[] = keep all. */
export function setFilterInclude(spec: PivotSpec, field: string, include: string[] | null): PivotSpec {
  return {
    ...spec,
    filters: (spec.filters ?? []).map((f) => (f.field === field ? { ...f, include: include && include.length ? include : undefined } : f)),
  };
}
export function filterIncludeOf(spec: PivotSpec, field: string): string[] | null {
  const f = (spec.filters ?? []).find((x) => x.field === field);
  return f?.include ?? null;
}
/** Set (or clear, with null) the "Filter by condition" predicate on a filter field. */
export function setFilterCondition(spec: PivotSpec, field: string, condition: PivotFilterCondition | null): PivotSpec {
  return {
    ...spec,
    filters: (spec.filters ?? []).map((f) => (f.field === field ? { ...f, condition: condition ?? undefined } : f)),
  };
}
export function filterConditionOf(spec: PivotSpec, field: string): PivotFilterCondition | null {
  return (spec.filters ?? []).find((x) => x.field === field)?.condition ?? null;
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

// Design-system tokens: the panel renders inside the host app, so these CSS custom
// properties (defined by the host's Untitled UI theme.css) resolve here — keeping the
// pivot editor on-brand (fiab-yellow, not blue) and theme-aware, matching <Button>.
const T = {
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
  textTertiary: "var(--color-text-tertiary)",
  textQuaternary: "var(--color-text-quaternary)",
  fgQuaternary: "var(--color-fg-quaternary)",
  brand: "var(--color-text-brand-primary)", // fiab-yellow-700 — links/accents
  borderPrimary: "var(--color-border-primary)",
  borderSecondary: "var(--color-border-secondary)",
  bg: "var(--color-bg-primary)",
  bgHover: "var(--color-bg-primary_hover)",
} as const;

// The exact Tailwind utility classes the host's <Button color="secondary"> and its
// Select/Input triggers use. These resolve against the host's globally-loaded compiled
// CSS (the panel mounts in the host DOM), so the buttons render pixel-identically to the
// design system — inset ring + skeuomorphic shadow, not a flat outline.
const CLS_SECONDARY_BTN =
  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer bg-primary text-secondary ring-1 ring-inset ring-primary shadow-xs-skeumorphic transition duration-100 hover:bg-primary_hover hover:text-secondary_hover";
const CLS_SELECT_TRIGGER =
  "flex w-full box-border items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 text-xs cursor-pointer bg-primary text-primary ring-1 ring-inset ring-primary shadow-xs transition duration-100 hover:bg-primary_hover";

const drawer: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: 540,
  background: T.bg,
  borderLeft: `1px solid ${T.borderSecondary}`,
  boxShadow: "-8px 0 24px rgba(16,24,40,0.08)",
  display: "flex",
  flexDirection: "column",
  zIndex: 50,
};

// Right-hand "Fields" rail — the persistent, draggable source list of every field, mirroring
// Google Sheets. Fields stay here even once placed, so you can drag the same field into more
// than one section (e.g. group by Amount in Rows AND sum Amount in Values).
const fieldsRail: CSSProperties = {
  width: 200,
  flexShrink: 0,
  borderLeft: `1px solid ${T.borderSecondary}`,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background: "var(--color-bg-secondary)",
};
const fieldsList: CSSProperties = { display: "flex", flexDirection: "column", gap: 5, overflowY: "auto", padding: "2px 12px 16px" };
const fieldChip: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, fontSize: 12.5, color: "var(--color-text-primary)", cursor: "grab", background: "var(--color-bg-primary)", border: "1px solid var(--color-border-secondary)", userSelect: "none" };
const fieldDot: CSSProperties = { width: 6, height: 6, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box" };
// Header carries a bottom divider so it reads as a distinct band above the body (Google Sheets).
const header: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", flexShrink: 0, borderBottom: `1px solid ${T.borderSecondary}` };
const titleWrap: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0 };
const titleStyle: CSSProperties = { fontSize: 15, fontWeight: 600, color: T.textPrimary };
const closeBtn: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: T.textTertiary, cursor: "pointer" };
const bodyStyle: CSSProperties = { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 16px" };
const searchInput: CSSProperties = { width: "100%", height: 34, borderRadius: 8, border: `1px solid ${T.borderPrimary}`, padding: "0 12px", fontSize: 13, boxSizing: "border-box", outline: "none", color: T.textPrimary, background: T.bg };
const chipRemove: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: 4, border: "none", background: "transparent", color: T.fgQuaternary, cursor: "pointer", flexShrink: 0, padding: 0 };

// Title-case section labels (Rows / Columns / Values / Filters / Fields) — matches Google
// Sheets, which does NOT shout them in all-caps.
const areaTitle: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: T.textSecondary };
const emptyHint: CSSProperties = { fontSize: 11.5, color: T.textQuaternary, fontStyle: "italic" };

const DND_MIME = "application/x-levich-pivot-field";
// Carries the AREA a drag originated from ("" = dragged from the fields list). A drag from a
// section chip is a MOVE (vacates the source); a drag from the fields list is an ADD.
const DND_AREA = "application/x-levich-pivot-src-area";

const cardStyle: CSSProperties = { border: `1px solid ${T.borderSecondary}`, borderRadius: 8, background: T.bg, padding: 10, display: "flex", flexDirection: "column", gap: 8 };
const cardHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 };
const cardName: CSSProperties = { fontSize: 13, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "grab" };
const ctrlLabel: CSSProperties = { fontSize: 11, color: T.textTertiary, marginBottom: 3, display: "block" };
const ctrlRow: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
// (+Add buttons and dropdown triggers use the host <Button>/Select Tailwind classes —
// CLS_SECONDARY_BTN / CLS_SELECT_TRIGGER above — for a pixel-exact design-system match.)
const sectionHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 6px" };
const popover: CSSProperties = { position: "absolute", zIndex: 60, minWidth: 160, maxHeight: 260, overflowY: "auto", background: T.bg, border: `1px solid ${T.borderSecondary}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,0.12)", padding: 4, marginTop: 4 };
const popItem = (active: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, fontSize: 12.5, color: T.textSecondary, cursor: "pointer", background: active ? T.bgHover : "transparent", whiteSpace: "nowrap" });

/** A design-system dropdown (button + popover) — replaces the native <select>. */
function Select<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);
  const cur = options.find((o) => o.value === value) ?? options[0];
  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={CLS_SELECT_TRIGGER} onClick={() => setOpen((o) => !o)} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur?.label}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: T.fgQuaternary }} />
      </button>
      {open && (
        <div style={popover} role="listbox">
          {options.map((o) => (
            <div key={o.value} role="option" className="lvpv-item" aria-selected={o.value === value} style={popItem(o.value === value)} onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export interface PivotPanelProps {
  /** Every field available from the source (drawn as the draggable chip list). */
  fields: string[];
  /** The current spec (controlled). */
  spec: PivotSpec;
  /** Fired with the next spec on any change. */
  onChange: (spec: PivotSpec) => void;
  /** Close the drawer (host toggles visibility). */
  onClose?: () => void;
  /** Distinct values of a field (for the "Filter by values" checklist). */
  distinctValues?: (field: string) => string[];
  /** Type-detected default aggregate for a field added to Values — SUM for numeric columns,
   *  COUNTA ("count") for text/date/mixed, mirroring Google Sheets (so text values don't all
   *  render 0 under a nonsensical SUM). Defaults to "sum" when not provided. */
  defaultAggregate?: (field: string) => PivotAggregate;
  /** All collapsible row-group paths of the current model — drives the "Collapse all" action.
   *  Supplied by the host (which owns the computed model) so the panel needn't import the engine. */
  collapsiblePaths?: string[];
}

// Google-Sheets section order: Rows, Columns, Values, Filters.
const SECTION_ORDER: Array<{ key: PivotArea; label: string }> = [
  { key: "rows", label: "Rows" },
  { key: "columns", label: "Columns" },
  { key: "values", label: "Values" },
  { key: "filters", label: "Filters" },
];

export function PivotPanel({ fields, spec, onChange, onClose, distinctValues, defaultAggregate, collapsiblePaths }: PivotPanelProps) {
  // Type-detected aggregate for a field newly placed in Values (SUM numeric / COUNTA text).
  const aggFor = (field: string): PivotAggregate => defaultAggregate?.(field) ?? "sum";
  // Place a field, auto-picking the Values aggregate when the target is Values.
  const place = (field: string, area: PivotArea, index?: number, moveFrom?: PivotArea): PivotSpec =>
    placeField(spec, field, area, index, moveFrom, area === "values" ? aggFor(field) : undefined);
  const [dragField, setDragField] = useState<string | null>(null);
  const [dragSourceArea, setDragSourceArea] = useState<PivotArea | null>(null); // null = from the fields list
  const [overArea, setOverArea] = useState<PivotArea | null>(null);
  const [addOpen, setAddOpen] = useState<PivotArea | null>(null); // which section's "Add" menu is open
  const [addQuery, setAddQuery] = useState("");
  const [fieldQuery, setFieldQuery] = useState(""); // search box in the fields rail
  const [filterOpen, setFilterOpen] = useState<string | null>(null); // which filter field's checklist is open
  const [filterSearch, setFilterSearch] = useState(""); // search box inside the open filter checklist

  // Resizable width (drag the left edge). Persisted so the user's preferred width sticks.
  const MIN_W = 340;
  const MAX_W = 760;
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem("lvpv-panel-width"));
      return saved >= MIN_W && saved <= MAX_W ? saved : 540;
    } catch {
      return 480;
    }
  });
  // Latest width (read by the drag's mouseup to persist) + the in-flight drag handlers, so a
  // cleanup effect can detach them if the panel unmounts mid-drag (no leaked listeners / no
  // setState on an unmounted component).
  const widthRef = useRef(width);
  const dragHandlersRef = useRef<{ move?: (e: MouseEvent) => void; up?: () => void }>({});
  useEffect(
    () => () => {
      const h = dragHandlersRef.current;
      if (h.move) document.removeEventListener("mousemove", h.move);
      if (h.up) document.removeEventListener("mouseup", h.up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [],
  );
  const onResizeDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const onMove = (ev: MouseEvent) => {
      // Panel is right-anchored, so dragging the left edge LEFT (smaller clientX) widens it.
      const next = Math.min(MAX_W, Math.max(MIN_W, startW + (startX - ev.clientX)));
      widthRef.current = next;
      setWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      dragHandlersRef.current = {};
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem("lvpv-panel-width", String(widthRef.current));
      } catch {
        /* localStorage unavailable — width still applies for the session */
      }
    };
    dragHandlersRef.current = { move: onMove, up: onUp };
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // `sourceArea` is the section a placed chip is dragged FROM (→ MOVE). Omit it when dragging
  // from the fields rail (→ ADD, so the field stays wherever else it already lives).
  const startDrag = (field: string, sourceArea?: PivotArea) => (e: DragEvent) => {
    setDragField(field);
    setDragSourceArea(sourceArea ?? null);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData(DND_MIME, field);
      e.dataTransfer.setData(DND_AREA, sourceArea ?? "");
      e.dataTransfer.setData("text/plain", field);
    } catch {
      /* some browsers restrict custom MIME in tests — the ref fallback covers it */
    }
  };
  const endDrag = () => { setDragField(null); setDragSourceArea(null); setOverArea(null); };
  const fieldFrom = (e: DragEvent): string | null => e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain") || dragField;
  const areaFrom = (e: DragEvent): PivotArea | undefined => {
    const a = e.dataTransfer.getData(DND_AREA);
    return (a || dragSourceArea || undefined) as PivotArea | undefined;
  };
  const dropOnArea = (area: PivotArea, index?: number) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fieldFrom(e);
    const from = areaFrom(e);
    endDrag();
    if (field) onChange(place(field, area, index, from));
  };
  const allowDrop = (area: PivotArea) => (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overArea !== area) setOverArea(area);
  };
  const removeChip = (field: string, area: PivotArea) => onChange(removeFromArea(spec, field, area));

  const addRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!addOpen) return;
    const onDown = (e: MouseEvent) => { if (addRef.current && !addRef.current.contains(e.target as Node)) { setAddOpen(null); setAddQuery(""); } };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [addOpen]);

  const filterRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(null); };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [filterOpen]);

  const addableFields = (area: PivotArea): string[] => {
    const q = addQuery.trim().toLowerCase();
    const inArea = new Set(fieldsInArea(spec, area));
    return fields.filter((f) => !inArea.has(f) && (q ? f.toLowerCase().includes(q) : true));
  };

  // "Sort by" choices for a Rows/Columns field: the field's own labels (default) or any
  // configured Value (sorts the groups by that aggregated number). Mirrors Google Sheets.
  const sortByOptions = (dimField: string): Array<{ value: string; label: string }> => [
    { value: SORT_BY_LABEL, label: dimField },
    ...spec.values.map((v) => ({ value: v.field, label: valueLabel(v) })),
  ];
  const dimCard = (field: string): ReactNode => {
    const s = dimSettingOf(spec, field);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={ctrlRow}>
          <div>
            <label style={ctrlLabel}>Order</label>
            <Select value={s.order ?? "asc"} options={ORDER_OPTS} ariaLabel={`Order for ${field}`} onChange={(v) => onChange(setDimSetting(spec, field, { order: v }))} />
          </div>
          <div>
            <label style={ctrlLabel}>Sort by</label>
            <Select
              value={s.sortBy ?? SORT_BY_LABEL}
              options={sortByOptions(field)}
              ariaLabel={`Sort ${field} by`}
              onChange={(v) => onChange(setDimSetting(spec, field, { sortBy: v === SORT_BY_LABEL ? undefined : v }))}
            />
          </div>
        </div>
        {/* "Group by" — bucket dates (Year/Month/…) or numbers into intervals, like Google Sheets. */}
        <div style={ctrlRow}>
          <div>
            <label style={ctrlLabel}>Group by</label>
            <Select
              value={groupOptOf(s.groupRule)}
              options={GROUP_OPTS}
              ariaLabel={`Group ${field} by`}
              onChange={(v) => onChange(setDimSetting(spec, field, { groupRule: groupRuleFor(v as GroupOpt, s.groupRule?.kind === "number" ? s.groupRule.size : undefined) }))}
            />
          </div>
          {s.groupRule?.kind === "number" && (
            <div>
              <label style={ctrlLabel}>Bucket size</label>
              <input
                type="number"
                min={1}
                value={s.groupRule.size}
                aria-label={`Bucket size for ${field}`}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  // Ignore empty / non-positive input (don't snap to 1 mid-edit and re-bucket into
                  // thousands of size-1 groups) — keep the current rule until a valid size is typed.
                  if (!Number.isFinite(size) || size <= 0) return;
                  onChange(setDimSetting(spec, field, { groupRule: { kind: "number", size, start: s.groupRule?.kind === "number" ? s.groupRule.start : undefined } }));
                }}
                style={{ width: "100%", height: 34, borderRadius: 8, border: `1px solid ${T.borderPrimary}`, padding: "0 10px", fontSize: 12.5, boxSizing: "border-box", color: T.textPrimary, background: T.bg }}
              />
            </div>
          )}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.textSecondary }}>
          <input type="checkbox" style={{ accentColor: "var(--color-fiab-yellow-600)" }} checked={s.showTotals ?? true} onChange={(e) => onChange(setDimSetting(spec, field, { showTotals: e.target.checked }))} />
          Show totals
        </label>
      </div>
    );
  };
  const valueCard = (field: string): ReactNode => {
    const v = spec.values.find((x) => x.field === field);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={ctrlRow}>
          <div>
            <label style={ctrlLabel}>Summarize by</label>
            <Select value={aggregateOfValue(spec, field)} options={PIVOT_AGGREGATES} ariaLabel={`Summarize ${field}`} onChange={(a) => onChange(setValueAggregate(spec, field, a))} />
          </div>
          <div>
            <label style={ctrlLabel}>Show as</label>
            <Select value={v?.showAs ?? "default"} options={PIVOT_SHOW_AS} ariaLabel={`Show ${field} as`} onChange={(m) => onChange(setValueShowAs(spec, field, m))} />
          </div>
        </div>
        {v?.aggregate === "custom" && (
          <div>
            <label style={ctrlLabel}>Formula</label>
            <input
              type="text"
              value={v.formula ?? ""}
              placeholder="e.g. ROUND(Amount / Orders, 2)"
              aria-label={`Formula for ${field}`}
              onChange={(e) => onChange(setValueFormula(spec, field, e.target.value))}
              style={{ width: "100%", height: 34, borderRadius: 8, border: `1px solid ${T.borderPrimary}`, padding: "0 10px", fontSize: 12.5, boxSizing: "border-box", color: T.textPrimary, background: T.bg }}
            />
            <span style={{ ...emptyHint, display: "block", marginTop: 3 }}>Arithmetic (+ − × ÷), numbers, comparisons, and functions (ABS, ROUND, MIN, MAX, SQRT, POWER, MOD, IF) over other value fields.</span>
          </div>
        )}
        <div>
          <label style={ctrlLabel}>Number format</label>
          <Select
            value={numFmtTokenOf(v?.numFmt)}
            options={VALUE_NUMFMT_OPTS}
            ariaLabel={`Number format for ${field}`}
            onChange={(tok) => onChange(setValueNumFmt(spec, field, VALUE_NUMFMT_OPTS.find((o) => o.value === tok)?.pattern))}
          />
        </div>
      </div>
    );
  };
  const filterCard = (field: string): ReactNode => {
    const include = filterIncludeOf(spec, field);
    const all = distinctValues?.(field) ?? [];
    const kept = include ?? all;
    const label = !include || include.length === all.length ? "Showing all items" : `Showing ${include.length} of ${all.length}`;
    return (
      <div ref={filterOpen === field ? filterRef : undefined} style={{ position: "relative" }}>
        <label style={ctrlLabel}>Filter by values</label>
        <button type="button" className={CLS_SELECT_TRIGGER} onClick={() => { setFilterSearch(""); setFilterOpen((f) => (f === field ? null : field)); }} aria-haspopup="dialog">
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <ChevronDown size={14} style={{ flexShrink: 0, color: T.fgQuaternary }} />
        </button>
        {filterOpen === field && (
          <div style={{ ...popover, width: 220, maxHeight: 300 }} role="dialog" aria-label={`Filter ${field}`}>
            <input
              style={{ ...searchInput, height: 30, margin: "2px 2px 6px", width: "calc(100% - 4px)" }}
              placeholder="Search values"
              value={filterSearch}
              autoFocus
              aria-label={`Search ${field} values`}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, padding: "0 8px 6px", fontSize: 12, fontWeight: 600 }}>
              <button type="button" className="lvpv-link" style={{ color: T.brand, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => onChange(setFilterInclude(spec, field, null))}>Select all</button>
              <button type="button" className="lvpv-link" style={{ color: T.brand, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => onChange(setFilterInclude(spec, field, []))}>Clear</button>
            </div>
            {all.length === 0 && <div style={{ ...emptyHint, padding: "6px 10px" }}>No values.</div>}
            {all
              .filter((val) => { const q = filterSearch.trim().toLowerCase(); return q ? String(val === "" ? "(blank)" : val).toLowerCase().includes(q) : true; })
              .map((val) => {
              const checked = kept.includes(val);
              return (
                <label key={val} className="lvpv-item" style={popItem(false)}>
                  <input
                    type="checkbox"
                    style={{ accentColor: "var(--color-fiab-yellow-600)" }}
                    checked={checked}
                    onChange={() => {
                      const next = checked ? kept.filter((x) => x !== val) : [...kept, val];
                      onChange(setFilterInclude(spec, field, next.length === all.length ? null : next));
                    }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val === "" ? "(blank)" : val}</span>
                </label>
              );
            })}
          </div>
        )}
        {/* Filter by CONDITION — a predicate applied to the raw value before aggregation. */}
        {(() => {
          const cond = filterConditionOf(spec, field);
          const condType: CondType = cond?.type ?? "none";
          const cv1 = cond && "value" in cond ? String(cond.value) : "";
          const cv2 = cond ? (cond.type === "between" ? String(cond.value2) : cond.type === "dateBetween" ? cond.value2 : "") : "";
          const isRange = condType === "between" || condType === "dateBetween";
          const inputType = COND_DATE.has(condType) ? "date" : COND_NUMERIC.has(condType) ? "number" : "text";
          const inputStyle = { flex: 1, minWidth: 0, height: 32, borderRadius: 8, border: `1px solid ${T.borderPrimary}`, padding: "0 10px", fontSize: 12.5, boxSizing: "border-box" as const, color: T.textPrimary, background: T.bg };
          return (
            <div style={{ marginTop: 8 }}>
              <label style={ctrlLabel}>Filter by condition</label>
              <Select
                value={condType}
                options={FILTER_COND_OPTS}
                ariaLabel={`Filter ${field} by condition`}
                onChange={(t) => onChange(setFilterCondition(spec, field, buildCondition(t as CondType, cv1, cv2)))}
              />
              {condType === "dateRelative" ? (
                <div style={{ marginTop: 6 }}>
                  <Select
                    value={cv1 || "today"}
                    options={PIVOT_DATE_RELATIVE_OPTS as unknown as Array<{ value: string; label: string }>}
                    ariaLabel={`Relative date window for ${field}`}
                    onChange={(w) => onChange(setFilterCondition(spec, field, buildCondition("dateRelative", w, cv2)))}
                  />
                </div>
              ) : (
                !COND_NO_VALUE.has(condType) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input
                      type={inputType}
                      value={cv1}
                      placeholder={isRange ? "From" : "Value"}
                      aria-label={`Condition value for ${field}`}
                      onChange={(e) => onChange(setFilterCondition(spec, field, buildCondition(condType, e.target.value, cv2)))}
                      style={inputStyle}
                    />
                    {isRange && (
                      <input
                        type={inputType}
                        value={cv2}
                        placeholder="To"
                        aria-label={`Condition upper value for ${field}`}
                        onChange={(e) => onChange(setFilterCondition(spec, field, buildCondition(condType, cv1, e.target.value)))}
                        style={inputStyle}
                      />
                    )}
                  </div>
                )
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <aside style={{ ...drawer, width }} role="dialog" aria-label="Pivot table editor">
      {/* Left-edge resize handle — drag to widen/narrow the panel (the whole editor is an
          expandable section separate from the sheet). A hairline that thickens/tints on hover. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize pivot table editor"
        title="Drag to resize"
        onMouseDown={onResizeDown}
        className="lvpv-resize"
        style={{ position: "absolute", left: -3, top: 0, bottom: 0, width: 6, cursor: "ew-resize", zIndex: 70 }}
      />
      {/* Scoped hover states so the buttons feel like the host's <Button> (which uses
          bg-primary_hover on hover). Inline styles can't express :hover. */}
      <style>{`
        .lvpv-icon-btn:hover { background: var(--color-bg-primary_hover); color: var(--color-text-secondary); }
        .lvpv-item:hover { background: var(--color-bg-primary_hover); }
        .lvpv-link:hover { text-decoration: underline; }
        .lvpv-resize::after { content: ""; position: absolute; left: 2px; top: 0; bottom: 0; width: 2px; background: transparent; transition: background 100ms; }
        .lvpv-resize:hover::after { background: var(--color-fiab-yellow-600); }
      `}</style>
      <header style={header}>
        <span style={titleWrap}>
          {/* Pivot-table glyph (brand-tinted) — mirrors the Google-Sheets editor header. */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-fiab-yellow-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span style={titleStyle}>Pivot table editor</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {collapsiblePaths && collapsiblePaths.length > 0 && (
            <>
              <button
                type="button"
                className="lvpv-link"
                style={{ color: T.brand, fontWeight: 600, fontSize: 12.5, background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}
                onClick={() => onChange(expandAll(spec))}
                data-testid="pivot-expand-all"
              >
                Expand all
              </button>
              <button
                type="button"
                className="lvpv-link"
                style={{ color: T.brand, fontWeight: 600, fontSize: 12.5, background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}
                onClick={() => onChange(collapseAll(spec, collapsiblePaths))}
                data-testid="pivot-collapse-all"
              >
                Collapse all
              </button>
            </>
          )}
          <button
            type="button"
            className="lvpv-link"
            style={{ color: T.brand, fontWeight: 600, fontSize: 12.5, background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}
            onClick={() => onChange(clearAll(spec))}
            data-testid="pivot-clear-all"
          >
            Clear all
          </button>
          {onClose && (
            <button type="button" aria-label="Close" className="lvpv-icon-btn" onClick={onClose} style={closeBtn}>
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left column: the four drop sections (Rows · Columns · Values · Filters). */}
        <div style={bodyStyle}>
          {SECTION_ORDER.map(({ key, label }) => {
            const placed = fieldsInArea(spec, key);
            const active = overArea === key;
            return (
              <div key={key} data-testid={`area-${key}`}>
                <div style={sectionHead}>
                  <span style={areaTitle}>{label}</span>
                  <div ref={addOpen === key ? addRef : undefined} style={{ position: "relative" }}>
                    <button type="button" className={CLS_SECONDARY_BTN} onClick={() => { setAddOpen((a) => (a === key ? null : key)); setAddQuery(""); }} data-testid={`add-${key}`} aria-label={`Add to ${label}`}>
                      <Plus size={14} style={{ color: T.fgQuaternary }} /> Add
                    </button>
                    {addOpen === key && (
                      <div style={{ ...popover, right: 0, width: 200 }} role="menu">
                        <input style={{ ...searchInput, height: 30, margin: "2px 2px 6px" }} placeholder="Search fields" value={addQuery} autoFocus onChange={(e) => setAddQuery(e.target.value)} aria-label="Search fields to add" />
                        {addableFields(key).map((f) => (
                          <div key={f} role="menuitem" className="lvpv-item" style={popItem(false)} onClick={() => { onChange(place(f, key)); setAddOpen(null); setAddQuery(""); }} data-testid={`add-field-${key}-${f}`}>
                            {f}
                          </div>
                        ))}
                        {addableFields(key).length === 0 && <div style={{ ...emptyHint, padding: "6px 10px" }}>No fields.</div>}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  onDragOver={allowDrop(key)}
                  onDragLeave={() => setOverArea((a) => (a === key ? null : a))}
                  onDrop={dropOnArea(key)}
                  style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 8, padding: active ? 6 : 0, borderRadius: 8, background: active ? "var(--color-utility-brand-50)" : "transparent", border: active ? "1px dashed var(--color-border-brand_alt)" : "1px solid transparent" }}
                >
                  {placed.length === 0 && <span style={emptyHint}>Drag a field here, or use Add.</span>}
                  {key === "values" && placed.length > 1 && (
                    <div style={{ marginBottom: 2 }}>
                      <label style={ctrlLabel}>Show values in</label>
                      <Select value={valuesAxisOf(spec)} options={VALUES_AXIS_OPTS} ariaLabel="Values placement" onChange={(a) => onChange(setValuesAxis(spec, a))} />
                    </div>
                  )}
                  {placed.map((field, i) => (
                    <div
                      key={field}
                      style={cardStyle}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={dropOnArea(key, i)}
                      data-testid={`chip-${key}-${field}`}
                    >
                      <div style={cardHead}>
                        <span style={cardName} draggable onDragStart={startDrag(field, key)} onDragEnd={endDrag} title={field}>{field}</span>
                        <button type="button" aria-label={`Remove ${field}`} onClick={() => removeChip(field, key)} style={chipRemove}><X size={13} /></button>
                      </div>
                      {(key === "rows" || key === "columns") && dimCard(field)}
                      {key === "values" && valueCard(field)}
                      {key === "filters" && filterCard(field)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Table options — grand-total label + layout toggles (Google-Sheets "Totals"/layout). */}
          <div data-testid="area-table-options">
            <div style={sectionHead}>
              <span style={areaTitle}>Table options</span>
            </div>
            <div style={{ padding: "0 2px 8px" }}>
              <label style={ctrlLabel}>Grand total label</label>
              <input
                type="text"
                value={spec.grandTotalLabel ?? ""}
                placeholder="Grand Total"
                aria-label="Grand total label"
                onChange={(e) => onChange(setGrandTotalLabel(spec, e.target.value))}
                style={{ width: "100%", height: 32, borderRadius: 8, border: `1px solid ${T.borderPrimary}`, padding: "0 10px", fontSize: 12.5, boxSizing: "border-box", color: T.textPrimary, background: T.bg }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.textSecondary, marginTop: 8 }}>
                <input type="checkbox" style={{ accentColor: "var(--color-fiab-yellow-600)" }} checked={spec.blankRowBetweenGroups ?? false} onChange={(e) => onChange(setPivotLayoutOption(spec, { blankRowBetweenGroups: e.target.checked }))} />
                Blank row between groups
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.textSecondary, marginTop: 6 }}>
                <input type="checkbox" style={{ accentColor: "var(--color-fiab-yellow-600)" }} checked={spec.centerGroupLabels ?? false} onChange={(e) => onChange(setPivotLayoutOption(spec, { centerGroupLabels: e.target.checked }))} />
                Center group labels
              </label>
            </div>
          </div>
        </div>

        {/* Right column: the persistent, draggable Fields rail (the Google-Sheets source list).
            A field stays here after placement so it can be dragged into more than one section. */}
        <div style={fieldsRail}>
          <div style={{ ...areaTitle, padding: "18px 14px 10px" }}>Fields</div>
          {fields.length > 6 && (
            <input style={{ ...searchInput, height: 32, margin: "0 12px 10px", width: "auto" }} placeholder="Search" value={fieldQuery} onChange={(e) => setFieldQuery(e.target.value)} aria-label="Search available fields" />
          )}
          <div style={fieldsList}>
            {fields
              .filter((f) => { const q = fieldQuery.trim().toLowerCase(); return q ? f.toLowerCase().includes(q) : true; })
              .map((f) => {
                const inUse = areaOfField(spec, f) !== null;
                return (
                  <div
                    key={f}
                    draggable
                    onDragStart={startDrag(f)}
                    onDragEnd={endDrag}
                    title={inUse ? `${f} — already in use; drag to add to another area` : `${f} — drag into a section`}
                    data-testid={`field-${f}`}
                    style={{ ...fieldChip, opacity: inUse ? 0.6 : 1 }}
                  >
                    <span style={{ ...fieldDot, background: inUse ? "var(--color-fiab-yellow-600)" : "transparent", border: inUse ? "none" : `1px solid ${T.borderPrimary}` }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
                  </div>
                );
              })}
            {fields.length === 0 && <div style={{ ...emptyHint, padding: "6px 10px" }}>No fields.</div>}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default PivotPanel;
