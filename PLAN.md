# Levich Univer Sheets — Full Implementation Plan

`@levich/univer-sheets`: a reusable, Levich-branded spreadsheet package that
wraps the free (Apache-2.0) Univer engine, so any website renders a full
Excel-like sheet with one line of code — editing, formulas, formatting, pivots,
and a download that includes every change the user made.

> **Status:** Planning complete. Awaiting go-ahead to start Stage 1.

---

## 0. Goal

One-line embed of a fully Levich-branded spreadsheet: editing, formulas,
configurable layout, pivot tables, and WYSIWYG `.xlsx` download.

## 1. Decisions locked

| Topic | Decision |
|---|---|
| Package name | `@levich/univer-sheets` |
| Relationship to Univer | Wrapper — Univer stays a dependency, version-locked |
| Where it runs | Browser only (consumed by fiab-ui) |
| Branding | Levich colors as the brand; reuse flux-poc paint otherwise; one theme file |
| Layout | Nothing hardcoded — freeze / locked columns / columns set by consumer |
| Download | **Full WYSIWYG** — exported `.xlsx` keeps all edits **+ colors, number formats, borders, merged cells, widths, frozen panes, table look**. Uses **ExcelJS** (SheetJS Community cannot write styles) |
| Pivot tables | In now — free, config-based (our own engine) |
| Opening Excel files | Later |
| Charts | Out (Univer Pro only) |
| Images | Optional, later |
| Dev linking | `file:` link now; publish later |

## 2. Logical architecture

```
┌──────────────────────────────────────────────┐
│  PUBLIC API   <LevichSheet/> + presets         │  ← consumer touches only this
├──────────────────────────────────────────────┤
│  LEVICH LAYER (we own + rebrand)               │
│   Branding · Config · Features · Pivot · Export │
├──────────────────────────────────────────────┤
│  UNIVER ENGINE (free, Apache-2.0, version-locked)│  ← hidden; draws the grid
└──────────────────────────────────────────────┘
```

## 3. Scope — Now vs Later

| Capability | v0.1 (Now) | Later |
|---|:--:|:--:|
| Branded spreadsheet render | ✅ | |
| Any data + configurable columns | ✅ | |
| Configurable freeze + locked columns | ✅ | |
| Editing, formulas, currency/date formatting | ✅ | |
| Comments + persistence hook | ✅ | |
| Column-width memory | ✅ | |
| Download `.xlsx` incl. all edits (WYSIWYG) | ✅ | |
| Transaction preset (flux-poc) | ✅ | |
| Pivot tables (free, config-based) | ✅ | |
| Levich branding | ✅ | |
| Open existing Excel files (import) | | 🔜 |
| Interactive drag-drop pivot | | 🔜 |
| Images | | 🔜 |
| Charts | ❌ Pro | |

## 4. Data flows

| Flow | Steps |
|---|---|
| **Render** | data + columns → build Univer workbook (formatting, freeze, locks) → Univer draws branded grid |
| **Edit** | user edits a cell → live workbook updates → optional `onCellEdit` hook fires |
| **Pivot** | data + pivot config → our engine groups + aggregates → result rendered as a range |
| **Export** | click Download → read **live** Univer snapshot (values + formula results + per-cell styles + merges + widths + freeze) → map to **ExcelJS** → write `.xlsx` → file looks exactly like the screen (colors/formats/tables preserved) |

## 5. Public API

```tsx
import { LevichSheet, TransactionSheet } from "@levich/univer-sheets";
import "@levich/univer-sheets/styles.css";

<LevichSheet
  data={rows}
  columns={[
    { key: "date",   header: "Date",   format: "date" },
    { key: "amount", header: "Amount", format: "currency", locked: true },
    { key: "note",   header: "Note",   editable: true },
  ]}
  freeze={{ rows: 1, columns: 0 }}                       // optional
  pivot={{ rows:["type"], columns:["entity"],
           values:["amount"], aggregate:"sum" }}         // optional
  onCellEdit={(cell) => { /* persist */ }}
  ref={ref}                                              // ref.exportXlsx()
/>
```

## 6. Package structure

```
Univer_Levich/  →  @levich/univer-sheets
├── package.json · tsup.config.ts · tsconfig.json
├── LICENSE · NOTICE · README.md
└── src/
    ├── index.ts                    public exports only
    ├── LevichSheet.tsx             the general component
    ├── core/    create-sheet · export-xlsx · types
    ├── theme/   levich-theme(.ts/.css) · branding-plugin · locales
    ├── features/ freeze · lock-columns · comments · column-widths · formatting · pivot
    └── presets/ transaction-sheet
```

---

## 7. Stages — detailed

### Stage 1 — Set up the package
**Goal:** empty but buildable package, Univer installed, license compliance.

| # | Task | Detail | Output |
|---|---|---|---|
| 1.1 | Init package | name, `type:module`, `main`/`types`/`exports` | package.json |
| 1.2 | Pin Univer exactly | presets + preset-sheets-core at exact `0.x.y` | locked deps |
| 1.3 | React as peer | `react`/`react-dom` peerDependencies | peer deps |
| 1.4 | Build tooling | tsup → ESM + d.ts + CSS; externalize react & univer | tsup.config.ts |
| 1.5 | TS config | strict TS, JSX, declarations | tsconfig.json |
| 1.6 | License files | LICENSE (Apache-2.0) + NOTICE crediting Univer | compliance |
| 1.7 | Empty entry | `src/index.ts` | builds clean |

**Done when:** `npm run build` produces `dist/` with no errors.

### Stage 2 — Basic sheet renders
**Goal:** mount Univer, show a grid.

| # | Task | Detail | Output |
|---|---|---|---|
| 2.1 | Mount helper | `core/create-sheet.ts` wraps `createUniver()` | create-sheet.ts |
| 2.2 | Minimal component | `LevichSheet.tsx` mounts, renders hardcoded workbook, disposes | LevichSheet v0 |
| 2.3 | CSS wiring | import Univer CSS; expose `styles.css` | styles export |
| 2.4 | Dev harness | local preview page | preview |

**Done when:** a plain sheet renders and cleans up.

### Stage 3 — General data API + WYSIWYG download
**Goal:** any data in; download includes edits.

| # | Task | Detail | Output |
|---|---|---|---|
| 3.1 | Public types | `SheetData`, `ColumnDef`, `LevichSheetProps` | types |
| 3.2 | Data → workbook | build workbook from data + columns | builder |
| 3.3 | Formatting | currency / date / number per column | formatting |
| 3.4 | Export (style-preserving) | read live snapshot → map cell values/styles/merges/widths/freeze → **ExcelJS** `.xlsx` | export |
| 3.6 | Fidelity test | open downloaded file in Excel → colors, currency, bold, borders, widths all present | WYSIWYG proof |
| 3.5 | Imperative ref | `ref.exportXlsx(fileName)` | ref API |

**Done when:** edited cell appears in the downloaded file (WYSIWYG test).

### Stage 4 — Smart pieces (configurable)
**Goal:** flux-poc behaviors, opt-in.

| # | Task | Detail | Output |
|---|---|---|---|
| 4.1 | Freeze | `freeze={{rows,columns}}` default + override | freeze |
| 4.2 | Locked columns | veto edits on chosen columns (Facade) | locks |
| 4.3 | Comments | editable comment column + persistence hook | comments |
| 4.4 | Column widths | remember widths via hook | widths |

**Done when:** all four work and are configurable.

### Stage 5 — Pivot tables (free, config-based)
**Goal:** pivots computed in code, rendered, exportable.

| # | Task | Detail | Output |
|---|---|---|---|
| 5.1 | Pivot engine | group rows/cols, aggregate (sum/count/avg/min/max), subtotals + grand total | engine |
| 5.2 | Pivot prop | `pivot={{rows,columns,values,aggregate}}` | API |
| 5.3 | Render result | output pivot as a styled range | render |
| 5.4 | Export-safe | pivot included in `.xlsx` | export |

**Done when:** pivot config renders correct totals and downloads. (Built from passed-in data.)

### Stage 6 — Paint it Levich
**Goal:** 100% Levich; reuse flux-poc styling, swap only brand color.

| # | Task | Detail | Output |
|---|---|---|---|
| 6.1 | Theme tokens | Levich colors/fonts/radius (one file) | tokens |
| 6.2 | CSS overrides | Univer CSS vars → Levich | css |
| 6.3 | Branding plugin | Levich logo, `simple` toolbar (reuse flux-poc) | branding |
| 6.4 | Labels | rename visible Univer text | locales |

**Done when:** nothing reads as "Univer"; brand color Levich; rest matches flux-poc.

### Stage 7 — Transaction preset
**Goal:** flux-poc view as one preset.

| # | Task | Detail | Output |
|---|---|---|---|
| 7.1 | Preset component | `<LevichSheet>` pre-configured | preset |
| 7.2 | Columns | Date·Tran#·Type·Entity·Debit·Credit·Amount·Memo·Comment | columns |
| 7.3 | Behaviors | frozen header, locked GL cols, editable comment, currency, `=SUM` footer | behaviors |
| 7.4 | Match check | compare vs flux-poc screenshot | parity |

**Done when:** `<TransactionSheet>` matches flux-poc.

### Stage 8 — Link into FinOpz
**Goal:** package runs inside fiab-ui.

| # | Task | Detail | Output |
|---|---|---|---|
| 8.1 | Local link | `file:../../../Univer_Levich` in fiab-ui | link |
| 8.2 | React dedupe | Vite `resolve.dedupe: ["react","react-dom"]` | single React |
| 8.3 | CSS import | import `styles.css` once | styles |
| 8.4 | Render in app | mount on a FinOpz page (start spike) | live in FinOpz |

**Done when:** FinOpz shows the branded sheet, all features working.

### Stage 9 — Versioning & rollback
**Goal:** safe, returnable releases.

| # | Task | Detail | Output |
|---|---|---|---|
| 9.1 | Tag release | version `0.1.0`, git tag | release |
| 9.2 | Update flow | bump Univer → test → new version | docs |
| 9.3 | Rollback flow | pin back to previous version | docs |
| 9.4 | Changelog | record engine version per release | CHANGELOG |

**Done when:** can release `0.1.0` and demonstrate rollback.

### Stage L — Later (after v0.1)

| Item | Note |
|---|---|
| Open existing Excel files | SheetJS (simple) + ExcelJS transformer (high fidelity) |
| Interactive drag-drop pivot | UI on top of the pivot engine |
| Images | free, native `@univerjs/sheets-drawing-ui` |
| Publish to registry | private/public install by version |

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Two React copies (wrapper bug) | `react` peer dep + Vite `resolve.dedupe` |
| Univer ESM/CSS build quirks | tsup externalizes Univer; ship CSS separately |
| Univer breaking change on upgrade | exact pin + rollback flow |
| Large bundle | lazy-load the sheet |
| Pivot fidelity from files | pivots built from data, not file pivot cache |
| Export loses styling | use **ExcelJS** writer (SheetJS Community can't write fills/fonts/borders) |
| License compliance | LICENSE + NOTICE from day one |

## 9. Sequencing

Stages 1→9 in order. 2–5 build the wrapper; 6–7 brand it; 8 proves it in FinOpz;
9 makes it releasable. Each stage is independently verifiable.
