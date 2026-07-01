---
description: "Task list for Univer Levich Sheets (@levich/univer-sheets)"
---

# Tasks: Univer Levich Sheets

**Input**: Design documents from `/specs/001-univer-levich-sheets/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md

**Tests**: A minimal, targeted test set is included because the Constitution makes the
full-fidelity export a NON-NEGOTIABLE contract (Principle III) and pivot correctness is
a measurable success criterion (SC-005). Other tests are optional.

**Organization**: Tasks grouped by user story for independent implementation/testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6 (Setup/Foundational/Polish carry no story label)
- All paths are repo-root-relative to `Univer_Levich/`

## Path Conventions
- Library: `src/`, `tests/` at repository root (`Univer_Levich/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the publishable package + license compliance

- [ ] T001 Create `package.json` (name `@levich/univer-sheets`, `type: module`, `main`/`types`/`exports` map with `.` and `./styles.css`, scripts build/dev/test) in `package.json`
- [ ] T002 Add EXACT-pinned deps `@univerjs/presets` + `@univerjs/preset-sheets-core` and `exceljs`; declare `react`/`react-dom` as peerDependencies in `package.json`
- [ ] T003 [P] Configure `tsup.config.ts` (ESM + `.d.ts` + CSS; externalize `react`, `react-dom`, `@univerjs/*`, `exceljs`) in `tsup.config.ts`
- [ ] T004 [P] Add `tsconfig.json` (strict, JSX react-jsx, declaration) in `tsconfig.json`
- [ ] T005 [P] Add `vitest.config.ts` + Testing Library setup in `vitest.config.ts`
- [ ] T006 [P] Add `LICENSE` (Apache-2.0) in `LICENSE`
- [ ] T007 [P] Add `NOTICE` crediting Univer (Apache-2.0) in `NOTICE`
- [ ] T008 [P] Create `CHANGELOG.md` with the engine-version-per-release convention in `CHANGELOG.md`
- [ ] T009 Install dependencies and confirm a clean empty build to `dist/` (verifies Setup)

**Checkpoint**: `npm run build` succeeds with an empty `src/index.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Engine lifecycle + workbook compiler all stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Define public + internal types (`SheetData`, `ColumnDef`, `FreezeConfig`, `PivotConfig`, `LevichSheetProps`, `LevichSheetHandle`, `CellEditEvent`, `BuiltWorkbook`, `Cell`) in `src/core/types.ts`
- [ ] T011 Implement Univer lifecycle wrapper (`createUniver()` mount, locale, theme hook, dispose) in `src/core/create-sheet.ts`
- [ ] T012 Implement workbook compiler: `data` + `columns` (+ freeze) → Univer `IWorkbookData` snapshot (`cellData`/`columnData`/`freeze`, style short-keys) in `src/core/build-workbook.ts`
- [ ] T013 [P] Implement formatting patterns (currency/date/number; keep values numeric) in `src/features/formatting.ts`
- [ ] T014 [P] Establish CSS pipeline + `styles.css` export wiring (Univer core CSS + placeholder Levich overrides) in `src/theme/levich-theme.css`
- [ ] T015 Create public entry skeleton exporting nothing breaking yet in `src/index.ts`
- [ ] T016 [P] [TEST] Unit test for `build-workbook` (columns→cells, formats, freeze, empty data) in `tests/unit/build-workbook.test.ts`

**Checkpoint**: compiler + lifecycle ready; user stories can begin.

---

## Phase 3: User Story 1 - Embed a branded, interactive spreadsheet (Priority: P1) 🎯 MVP

**Goal**: One component renders a fully Levich-branded, interactive sheet from any data with configurable columns/freeze/locks.

**Independent Test**: Embed `<LevichSheet>` with sample data + columns on a blank page → branded, scrollable, editable grid with frozen header, locked columns, and currency/date formatting.

- [ ] T017 [US1] Implement `LevichSheet.tsx` (mount via `create-sheet`, build workbook, render, dispose; isolate all `@univerjs` imports for lazy-loading) in `src/LevichSheet.tsx`
- [ ] T018 [P] [US1] Implement configurable freeze (rows/cols/none, default 1 row) in `src/features/freeze.ts`
- [ ] T019 [P] [US1] Implement locked-column veto via `BeforeSheetEditEnd` (fail-closed) in `src/features/lock-columns.ts`
- [ ] T020 [P] [US1] Implement Levich theme tokens (single brand-color source) in `src/theme/levich-theme.ts`
- [ ] T021 [P] [US1] Implement branding plugin (logo + `ribbonType: "simple"`) and locale overrides in `src/theme/branding-plugin.ts` and `src/theme/locales.ts`
- [ ] T022 [US1] Finalize Levich CSS-variable overrides so no Univer branding shows in `src/theme/levich-theme.css`
- [ ] T023 [US1] Wire `toolbar` prop + verify in-cell editing and formula recompute behavior in `src/LevichSheet.tsx`
- [ ] T024 [US1] Export `LevichSheet` + public types from `src/index.ts`

**Checkpoint**: US1 fully functional and independently demoable (MVP).

---

## Phase 4: User Story 2 - Full-fidelity download (Priority: P2)

**Goal**: `.xlsx` download mirrors the live sheet exactly — edits + styles + merges + widths + freeze.

**Independent Test**: Edit cells + a comment, download, open externally → edits AND colors/currency/bold/borders/merges/widths/frozen header all present.

- [ ] T025 [US2] Implement live-snapshot → ExcelJS mapping (values, `{formula,result}`, `numFmt`, font, fill, border, alignment) in `src/core/export-xlsx.ts`
- [ ] T026 [US2] Map worksheet-level fidelity: merged cells, column widths, frozen panes in `src/core/export-xlsx.ts`
- [ ] T027 [US2] Add safe-ready guard (export before mount resolves to 0, no corrupt file) in `src/core/export-xlsx.ts`
- [ ] T028 [US2] Expose `ref.exportXlsx(fileName)` imperative handle in `src/LevichSheet.tsx`; export `exportToXlsx` + `LevichSheetHandle` from `src/index.ts`
- [ ] T029 [US2] [TEST] Fidelity test: render → edit → export → re-open `.xlsx` via ExcelJS → assert values, comments, number formats, fill, bold, borders, merges, widths, freeze survive in `tests/fidelity/export-fidelity.test.ts`

**Checkpoint**: "Download what you see" contract verified (Constitution III).

---

## Phase 5: User Story 6 - Adopt & roll back versions safely (Priority: P2)

**Goal**: Reproducible, reversible releases keyed to an exact engine version.

**Independent Test**: Pin a version, build, confirm behavior; pin the prior version → identical prior behavior.

- [ ] T030 [US6] Verify EXACT engine pin (no range operators) and document the upgrade flow in `CHANGELOG.md`
- [ ] T031 [US6] Record the bundled engine version for `v0.1.0` and the rollback procedure in `CHANGELOG.md`
- [ ] T032 [P] [US6] Document release + rollback steps for consumers in `README.md`

**Checkpoint**: a tagged `v0.1.0` is reproducible and roll-back-able.

---

## Phase 6: User Story 3 - Pivot tables (Priority: P3)

**Goal**: Config-based pivot computed from data, rendered as styled cells, exported full-fidelity.

**Independent Test**: Supply data + pivot config → pivot with row/col groups, subtotals, grand total; download preserves it.

- [ ] T033 [US3] Implement free pivot engine (group rows/cols, aggregate sum/count/avg/min/max, subtotals, grand total) in `src/features/pivot.ts`
- [ ] T034 [US3] Wire `pivot` prop → render pivot region into the workbook snapshot in `src/LevichSheet.tsx` and `src/core/build-workbook.ts`
- [ ] T035 [US3] [TEST] Pivot correctness test vs manual calculation for a sample dataset in `tests/unit/pivot.test.ts`

**Checkpoint**: pivots render + export correctly.

---

## Phase 7: User Story 4 - Persistent notes & remembered widths (Priority: P3)

**Goal**: Editable comments with a persistence hook + restore; column-width memory.

**Independent Test**: Type a note → hook fires; reload with saved notes/widths → restored.

- [ ] T036 [US4] Implement editable comment column + `onCellEdit` via `SheetEditEnded` (debounced) + pre-fill from `comments` in `src/features/comments.ts`
- [ ] T037 [P] [US4] Implement column-width snapshot via width `CommandExecuted` + `onColumnWidthsChange` + restore from `columnWidths` in `src/features/column-widths.ts`
- [ ] T038 [US4] Wire comment + width props/hooks into `src/LevichSheet.tsx`

**Checkpoint**: notes/widths persist and restore via consumer hooks.

---

## Phase 8: User Story 5 - Transaction preset (Priority: P4)

**Goal**: Ready-made branded transaction view over `LevichSheet`.

**Independent Test**: Embed `<TransactionSheet>` with transactions → standard view (locked ledger cols, editable comment, currency, totals) with no extra config.

- [ ] T039 [US5] Define `TransactionRow`/`TransactionSheetProps` types in `src/core/types.ts`
- [ ] T040 [US5] Implement `TransactionSheet` preset (fixed columns, frozen header, locked ledger cols, editable comment, currency, `=SUM` totals; localStorage default keyed by subsidiary/account) in `src/presets/transaction-sheet.tsx`
- [ ] T041 [US5] Export `TransactionSheet` + preset types from `src/index.ts`

**Checkpoint**: preset matches the flux-poc reference behavior.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Prove the whole thing in a real host and finalize

- [ ] T042 Link into fiab-ui (`file:` dep) + add Vite `resolve.dedupe: ["react","react-dom"]`; render `<LevichSheet>` on a FinOpz page and smoke-test
- [ ] T043 [P] Verify lazy-loading keeps the engine out of the host main bundle
- [ ] T044 [P] Performance check: 20,000-row render + scroll without visible lag, and full-fidelity export of 20,000 rows under ~10s (SC-004, SC-009)
- [ ] T045 [P] Finalize `README.md` (install, usage, presets, release/rollback) and confirm `NOTICE`/`LICENSE` present
- [ ] T046 [P] Verify out-of-scope features (charts, images, file import, server-side generation) are cleanly excluded — the sheet renders no broken/placeholder artifacts when such content is absent or attempted (FR-020)
- [ ] T047 Tag `v0.1.0` and record engine version in `CHANGELOG.md`

---

## Dependencies & Execution Order

- **Setup (P1)** → no deps.
- **Foundational (P2)** → after Setup; BLOCKS all stories (types, lifecycle, compiler).
- **US1 (P1)** → after Foundational. MVP.
- **US2 (P2)** → after US1 (needs a rendered live sheet to export).
- **US6 (P2)** → after US2 (needs a buildable/releasable package).
- **Polish** → T047 (tag) is last; T046 (verify exclusion) covers FR-020.
- **US3 (P3)** → after US1 (renders into the same compiler); independent of US2/US4.
- **US4 (P3)** → after US1; independent of US2/US3.
- **US5 (P4)** → after US1 (+ benefits from US2/US4); composes existing features.
- **Polish** → after desired stories complete.

### Within each story
- Models/types before services; services before component wiring; component before tests.

### Parallel opportunities
- Setup: T003–T008 in parallel.
- Foundational: T013, T014, T016 in parallel with T011/T012 where files differ.
- US1: T018, T019, T020, T021 in parallel (distinct files) before T022–T024.
- US3 and US4 can proceed in parallel after US1 (different feature files).

## Implementation Strategy

### MVP First
1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE** (branded interactive sheet renders) → demo.

### Incremental Delivery
US1 (MVP) → US2 (full-fidelity export) → US6 (release/rollback) → US3 (pivot) → US4 (notes/widths) → US5 (preset) → Polish. Each adds value without breaking prior stories.

## Notes
- [P] = different files, no dependencies.
- Only 3 test tasks (T016, T029, T035) — fidelity (T029) is mandated by Constitution III.
- Reference implementation: `flux-poc/fiab-ui/app/src/components/account-canvas/*`.
- Commit after each task or logical group; do not break the public contract (`contracts/public-api.md`).
