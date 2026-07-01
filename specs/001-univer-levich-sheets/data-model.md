# Phase 1 Data Model: Univer Levich Sheets

These are the package's public/internal data shapes (TypeScript). Public types are
exported from `src/index.ts`; internal ones support the compile/export pipeline.

## Public types

### `SheetData`
The consumer's tabular data.
```ts
type SheetData = Array<Record<string, unknown>>;   // array of records keyed by field
```
- Validation: may be empty (renders headers only). Field keys referenced by
  `ColumnDef.key` and `PivotConfig` must exist on records (missing → blank cell).

### `ColumnDef`
Describes one on-sheet column. Drives header, formatting, and edit behavior.
```ts
interface ColumnDef {
  key: string;                                   // field in each record
  header: string;                                // display label (row 0)
  format?: "currency" | "date" | "number" | "text";  // default "text"
  locked?: boolean;                              // read-only (edit vetoed)
  editable?: boolean;                            // explicitly editable (e.g. comment)
  width?: number;                                // px; falls back to a default
}
```
- Rules: `locked` and `editable` are mutually exclusive; if both set, `locked` wins
  (fail-closed). `format: "currency"` uses `currencySymbol` (prop) for the pattern.

### `FreezeConfig`
Consumer-driven freezing. Never hard-coded.
```ts
type FreezeConfig =
  | false                                        // freeze nothing
  | { rows?: number; columns?: number };         // freeze N rows / M cols
// default when omitted: { rows: 1, columns: 0 }
```

### `PivotConfig`
Configuration-based pivot (computed from `data`).
```ts
interface PivotConfig {
  rows: string[];                                // group down the side
  columns: string[];                             // spread across the top
  values: string[];                              // field(s) summarized
  aggregate: "sum" | "count" | "average" | "min" | "max";
}
```
- Rules: all referenced keys should exist on records. Output includes subtotals per
  row group and a grand total. Sparse cells → empty/0 per `aggregate`.

### `LevichSheetProps`
The public component contract.
```ts
interface LevichSheetProps {
  data: SheetData;
  columns: ColumnDef[];
  freeze?: FreezeConfig;
  pivot?: PivotConfig;
  currencySymbol?: string | null;                // default "$"
  comments?: Record<string, string>;             // rowKey -> note (pre-fill)
  columnWidths?: Record<number, number>;         // colIndex -> px (restore)
  onCellEdit?: (e: CellEditEvent) => void;       // persistence hook
  onColumnWidthsChange?: (w: Record<number, number>) => void;
  toolbar?: "simple" | "full" | "none";          // default "simple"
}
```

### `CellEditEvent`
```ts
interface CellEditEvent { rowKey: string; row: number; column: number; value: string; }
```

### `TransactionSheetProps` (preset)
```ts
interface TransactionSheetProps {
  rows: TransactionRow[];                         // typed transaction rows
  currencySymbol?: string | null;
  subsidiaryId?: string; accountId?: string;      // persistence bucket
  comments?: Record<string, string>;
  columnWidths?: Record<number, number>;
}
```

### `LevichSheetHandle` (imperative ref)
```ts
interface LevichSheetHandle { exportXlsx: (fileName?: string) => Promise<number>; }
// returns the row count written; rejects/no-ops safely if the sheet isn't ready
```

## Internal types (compile + export pipeline)

### `WorkbookSnapshot` (Univer `IWorkbookData`, loose)
```ts
type Cell = { v?: string | number; f?: string; s?: Record<string, unknown> } | null;
interface BuiltWorkbook {
  workbookData: Record<string, unknown>;          // sheets[id].cellData/columnData/freeze
  rowCount: number;
  footerRowIndex?: number;                         // for totals/lock veto
}
```
- Style short-keys: `bl` bold, `cl` text color, `bg` fill, `n.pattern` number format,
  `ht` horizontal align.

### `PivotResult`
```ts
interface PivotResult {
  rowKeys: string[]; colKeys: string[];
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}
```

### `ExportableCell` (mapping target for ExcelJS)
```ts
interface ExportableCell {
  value: string | number | { formula: string; result?: number };
  numFmt?: string;                                 // currency/date pattern
  font?: { bold?: boolean; color?: string };
  fill?: { fgColor?: string };
  border?: Record<string, unknown>;
  alignment?: { horizontal?: "left" | "right" | "center" };
}
// plus worksheet-level: merges[], columnWidths[], frozen { row, col }
```

## Relationships

- `LevichSheetProps.data` + `columns` (+ `freeze`/`pivot`/`currencySymbol`) →
  `build-workbook.ts` → `BuiltWorkbook` → `createUniver().createWorkbook(...)`.
- `PivotConfig` → `pivot.ts` → `PivotResult` → appended into `BuiltWorkbook` cells.
- Live Univer snapshot → `export-xlsx.ts` → `ExportableCell[]` → ExcelJS → `.xlsx`.
- `TransactionRow[]` → preset → `LevichSheetProps` (fixed columns/locks) → same path.
