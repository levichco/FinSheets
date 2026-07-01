# Implementation Plan: Univer Levich Sheets

**Branch**: `001-univer-levich-sheets` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-univer-levich-sheets/spec.md`

## Summary

Build `@levich/univer-sheets`: a browser-only, reusable React package that wraps the
free (Apache-2.0) Univer spreadsheet engine behind a single embeddable component
(`<LevichSheet>`) plus a `TransactionSheet` preset. The package compiles consumer
data + column/freeze/lock/pivot configuration into a Univer workbook snapshot,
renders it fully Levich-branded, attaches configurable behaviors (read-only column
veto, comment persistence hook, column-width memory) via Univer's Facade event API,
and exports the LIVE sheet to a full-fidelity `.xlsx` using ExcelJS (preserving
edits, styles, number formats, merges, widths, frozen panes). Univer is pinned to an
exact version; React is a peer dependency; the engine is lazy-loaded.

## Technical Context

**Language/Version**: TypeScript 5.x (ESM), targeting React 18.3+ / 19 host apps
**Primary Dependencies**: `@univerjs/presets` + `@univerjs/preset-sheets-core` (pinned EXACT, e.g. `0.25.0`); `exceljs` (full-fidelity `.xlsx` write); build via `tsup`
**Peer Dependencies**: `react`, `react-dom` (`>=18`) — never bundled
**Storage**: N/A in-package (browser only). Persistence (comments, widths) is delegated to the consumer via hooks; the `TransactionSheet` preset MAY default to `localStorage`.
**Testing**: Vitest + Testing Library (unit/behavior); a fidelity test that re-opens an exported `.xlsx` (via ExcelJS read) and asserts styles/values survive
**Target Platform**: Modern browsers (canvas-rendered grid)
**Project Type**: Single library/package (publishable, consumed by fiab-ui first via `file:` link)
**Performance Goals**: Render + smooth scroll for 20,000+ rows without visible lag; engine lazy-loaded so it is absent from the host's main bundle until a sheet opens
**Constraints**: Browser-only (no server generation); single React instance (peer + host dedupe); free-tier Univer only (no Pro/exchange); full-fidelity export is a hard contract
**Scale/Scope**: ~1.5k LOC of Levich glue across ~6 feature modules + 1 component + 1 preset + theme + build/license scaffolding

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How this plan complies |
|---|---|---|
| I. Wrapper, Not Fork | ✅ PASS | Univer consumed as a dependency, pinned EXACT; no engine source vendored |
| II. Free-Tier Only | ✅ PASS | Only `@univerjs/presets` + `preset-sheets-core` (Apache-2.0); pivot is our own engine; no Pro/charts/exchange |
| III. Full-Fidelity Export | ✅ PASS | ExcelJS writer maps live snapshot (values + styles + merges + widths + freeze); fidelity test required (T-export) |
| IV. Consumer-Driven Layout | ✅ PASS | `data` + `columns` + `freeze` + `lockedColumns` + `pivot` props; transaction layout is a preset only |
| V. Clean Public Boundary | ✅ PASS | `src/index.ts` is the sole public surface; Univer never re-exported |
| VI. Single React Instance | ✅ PASS | `react`/`react-dom` as peerDependencies; tsup externalizes them; host dedupes |
| VII. License Compliance | ✅ PASS | `LICENSE` (Apache-2.0) + `NOTICE` crediting Univer added in Setup phase |
| VIII. Reproducible & Reversible | ✅ PASS | Semver releases; exact engine pin; CHANGELOG records engine version; rollback = pin prior version |
| IX. Browser-Only & Lazy-Loaded | ✅ PASS | No server target; component is `React.lazy`-friendly (all Univer imports isolated to the canvas module) |

**Result**: PASS — no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-univer-levich-sheets/
├── plan.md              # This file
├── spec.md              # Feature spec (/speckit.specify)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── public-api.md    # Phase 1 output — the package's public contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
Univer_Levich/
├── package.json              # name @levich/univer-sheets, EXACT univer pins, react peer, exports map
├── tsconfig.json
├── tsup.config.ts            # ESM + .d.ts + CSS; externalize react, react-dom, @univerjs/*, exceljs
├── vitest.config.ts
├── LICENSE                   # Apache-2.0
├── NOTICE                    # attribution to Univer
├── README.md
├── CHANGELOG.md              # records engine version per release
└── src/
    ├── index.ts              # PUBLIC API — the only import surface
    ├── LevichSheet.tsx       # general-purpose component (lazy-friendly: isolates univer imports)
    ├── core/
    │   ├── create-sheet.ts   # createUniver() lifecycle: mount, locale, theme, dispose
    │   ├── build-workbook.ts # data + columns + config → Univer IWorkbookData snapshot
    │   ├── export-xlsx.ts     # live snapshot → ExcelJS → full-fidelity .xlsx
    │   └── types.ts           # SheetData, ColumnDef, FreezeConfig, PivotConfig, LevichSheetProps
    ├── theme/
    │   ├── levich-theme.ts   # Levich design tokens (single source of brand color)
    │   ├── levich-theme.css  # CSS variable overrides
    │   ├── branding-plugin.ts# logo + simple toolbar styling
    │   └── locales.ts
    ├── features/
    │   ├── freeze.ts         # configurable frozen rows/cols
    │   ├── lock-columns.ts   # read-only veto via BeforeSheetEditEnd
    │   ├── comments.ts       # editable comment column + onCellEdit persistence hook
    │   ├── column-widths.ts  # width-change hook + restore
    │   ├── formatting.ts     # currency / date / number patterns
    │   └── pivot.ts          # FREE pivot engine: group + aggregate → snapshot region
    └── presets/
        └── transaction-sheet.tsx  # flux-poc transaction view as a preset
tests/
├── unit/                     # build-workbook, pivot, formatting, lock logic
└── fidelity/                 # export → re-read .xlsx → assert styles/values preserved
```

**Structure Decision**: Single library/package. Source under `src/` grouped as
`core` (engine lifecycle + workbook compile + export), `theme` (branding),
`features` (opt-in behaviors), `presets` (ready-made views), with one public
`index.ts`. Reference implementation lives in the flux-poc worktree
(`flux-poc/fiab-ui/app/src/components/account-canvas/*`) and is generalized here.

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
