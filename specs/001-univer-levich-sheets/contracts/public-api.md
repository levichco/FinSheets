# Public API Contract: `@levich/univer-sheets`

This is the package's external contract — the **only** surface consumers may use.
Anything not listed here is private and may change without a major version bump.

## Package entry (`src/index.ts`)

```ts
export { LevichSheet } from "./LevichSheet";
export { TransactionSheet } from "./presets/transaction-sheet";
export type {
  SheetData, ColumnDef, FreezeConfig, PivotConfig,
  LevichSheetProps, LevichSheetHandle, CellEditEvent,
  TransactionRow, TransactionSheetProps,
} from "./core/types";
// styles: import "@levich/univer-sheets/styles.css"
```

Univer types/objects are **NOT** re-exported (Constitution V).

## `<LevichSheet>` — general component

**Contract**
- Renders a fully Levich-branded spreadsheet from `data` + `columns`.
- Layout is consumer-driven: `freeze`, per-column `locked`, `columns` (no hard-coding).
- Editable cells accept values + formulas; locked columns reject edits silently.
- Currency/date/number columns are formatted but remain numerically valid.
- Optional `pivot` renders a computed pivot region.
- `ref.exportXlsx()` downloads the LIVE sheet at full fidelity.
- Emits `onCellEdit` (comment/edit persistence) and `onColumnWidthsChange`.

**Props**: see `data-model.md` → `LevichSheetProps`.
**Ref**: `LevichSheetHandle { exportXlsx(fileName?) => Promise<number> }`.

**Guarantees**
- G1: No `@univerjs` branding visible by default.
- G2: Exported `.xlsx` reflects live edits + comments + computed results (FR-011).
- G3: Exported `.xlsx` preserves colors, number formats, bold, borders, merges,
  column widths, frozen panes (FR-012).
- G4: With invalid/empty `data`, renders headers without throwing.
- G5: `exportXlsx()` before ready resolves to `0` (no corrupt file).

## `<TransactionSheet>` — preset

**Contract**: pre-configured `LevichSheet` for the accounting transaction view —
columns `Date · Tran # · Type · Entity · Debit · Credit · Amount · Memo · Comment`,
frozen header, locked ledger columns, editable Comment, currency formatting, `=SUM`
totals row. Accepts `TransactionSheetProps`; persists comments/widths by
`(subsidiaryId, accountId)`.

## Export helper

```ts
exportToXlsx(workbook, fileName?): Promise<number>   // internal-use; surfaced via ref
```
Reads the live Univer snapshot and writes a full-fidelity `.xlsx` via ExcelJS.

## Versioning contract

- SemVer. The bundled engine version is recorded per release in `CHANGELOG.md`.
- A given package version always resolves the same engine version (exact pin).
- Rolling back the package version restores exact prior behavior (FR-017/FR-018).
- Breaking changes to anything in THIS document require a MAJOR bump.

## Peer requirements

- Host provides a single `react` / `react-dom` (`>=18`) instance and dedupes it.
- Host imports the stylesheet once: `import "@levich/univer-sheets/styles.css"`.
