# Phase 0 Research: Univer Levich Sheets

All Technical Context unknowns are resolved below. Each entry: Decision · Rationale ·
Alternatives considered. Findings are grounded in the agreed `PLAN.md`, the flux-poc
reference implementation, and licensing/web research conducted during planning.

## R1. Engine relationship: wrapper vs hard fork

- **Decision**: Wrap Univer as an upstream dependency; do not fork its source.
- **Rationale**: Univer is a ~50-package, canvas-render + formula-engine monorepo
  (TypeScript). Forking transfers all of it onto our maintenance. Branding and
  behavior are fully achievable via theming + the Facade/plugin API, so a fork buys
  nothing for our goals while costing perpetual upstream merges.
- **Alternatives**: Hard fork (rejected — maintenance cost, loses free upstream
  fixes); using Luckysheet/Handsontable/ag-Grid (rejected — flux-poc already proved
  Univer; different APIs and licensing).

## R2. Export library for full-fidelity `.xlsx`

- **Decision**: Use **ExcelJS** (MIT) for export.
- **Rationale**: The hard requirement is "download exactly what you see" — colors,
  number formats, borders, merged cells, widths, frozen panes. SheetJS **Community**
  (used in flux-poc via `aoa_to_sheet`) writes **values only** and physically cannot
  write fills/fonts/borders (styling is a paid SheetJS feature). ExcelJS writes the
  full style set plus merges, column widths, frozen views, and `{formula, result}`
  cells, and is the same library we would reuse for a future import phase.
- **Alternatives**: SheetJS Community (rejected — no style write); `xlsx-js-style`
  (viable, closer to existing SheetJS code, but "basic styles" only and no Excel
  Table objects — kept as a fallback, not the default).

## R3. Pivot tables on the free tier

- **Decision**: Implement our **own** config-based pivot engine; render the result as
  ordinary styled cells.
- **Rationale**: Univer native pivot (`@univerjs-pro/sheets-pivot`) is commercial.
  The free engine renders plain cells perfectly, so computing the pivot
  (group + aggregate + subtotals + grand total) in code and emitting it as a cell
  region stays 100% free and exports with full fidelity automatically.
- **Alternatives**: Univer Pro pivot (rejected — paid + server); third-party pivot UI
  libs (deferred — interactive drag-drop pivot is out of scope this version).

## R4. Charts, images, file import — scope

- **Decision**: Charts OUT (commercial). Images and file-import DEFERRED (Later).
  Pivot stays IN (R3).
- **Rationale**: Native charts/pivot are `@univerjs-pro/*` (paid). Images are free
  (`@univerjs/sheets-drawing-ui`) but deferred to keep v1 focused. File import is
  doable free (ExcelJS/SheetJS parse → `createWorkbook`) but explicitly scheduled for
  a later phase per product decision.
- **Alternatives**: Re-implement charts via a free chart overlay (deferred — real
  engineering, not v1).

## R5. React integration & the double-React trap

- **Decision**: `react`/`react-dom` as **peerDependencies**; externalize in the build;
  host must `resolve.dedupe` React.
- **Rationale**: Bundling React into a component package yields two React instances →
  "invalid hook call". Univer's view layer is React 18.3+ and is compatible with a
  React 19 host when a single instance is shared.
- **Alternatives**: Bundle React (rejected — guaranteed breakage); web-component
  wrapper (rejected — unnecessary complexity for a React-first consumer).

## R6. Build tooling & distribution

- **Decision**: **tsup** producing ESM + `.d.ts` + a separate CSS file; `exports` map
  with `.` and `./styles.css`. Externalize `react`, `react-dom`, `@univerjs/*`,
  `exceljs`.
- **Rationale**: Smallest reliable setup for a typed React library; keeps heavy deps
  resolved at install (tiny bundle) and ships Univer + Levich CSS as one importable
  stylesheet.
- **Alternatives**: Vite library mode (viable alternative), Rollup direct (more
  config). tsup chosen for simplicity.

## R7. Version pinning & rollback

- **Decision**: Pin `@univerjs/*` to an EXACT version; semver the package; record the
  engine version per release in `CHANGELOG.md`.
- **Rationale**: Makes a package version ⇒ engine version a 1:1 mapping, so rolling
  back the package restores exact prior behavior (Constitution VIII).
- **Alternatives**: Caret ranges (rejected — silent engine drift breaks
  reproducibility/rollback).

## R8. Behavior wiring (locking, comments, widths)

- **Decision**: Use Univer's **Facade event API**: veto edits on locked cells via
  `BeforeSheetEditEnd` (`params.cancel = true`); persist comments on
  `SheetEditEnded`; snapshot widths on width `CommandExecuted`. Wrap in try/catch
  (best-effort across engine versions; exact pin reduces drift).
- **Rationale**: Proven in flux-poc; free; no paid range-protection needed.
- **Alternatives**: Univer Pro range protection (rejected — paid).

## R9. Branding approach ("Full Levich look")

- **Decision**: Levich design tokens via `createUniver({ theme })` + CSS-variable
  overrides + a branding plugin (logo, `ribbonType: "simple"`); brand color in ONE
  theme file. Reuse flux-poc styling unchanged; swap only the brand color/logo.
- **Rationale**: Achieves a 100%-Levich look without forking; single source of truth
  for the brand color keeps it the default and adjustable (Constitution IV/V).
- **Alternatives**: Forking the engine to restyle (rejected — R1).

## R10. Workbook snapshot shape (from flux-poc)

- **Decision**: Compile to Univer `IWorkbookData`: `sheets[id].cellData[row][col] =
  { v | f | s }`, `columnData[col] = { w }`, `freeze = { xSplit, ySplit, startRow,
  startColumn }`. Styles use Univer short keys (`bl`, `cl`, `bg`, `n.pattern`, `ht`).
- **Rationale**: Directly reuses the validated flux-poc `build-transaction-workbook`
  structure, generalized from 9 hard-coded columns to consumer-defined columns.
- **Alternatives**: Imperative Facade cell-by-cell construction (rejected — slower,
  more code than a single `createWorkbook(snapshot)`).
