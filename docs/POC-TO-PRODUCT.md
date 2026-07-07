# FinSheets — PoC → Realtime Product

> Turns the lazy-load PoC (`localhost:9100/?poc`, custom top tab strip, one sheet
> per Univer workbook) into the real product (`localhost:9100`, native footer tabs,
> per-sheet rename/edit/duplicate) — while keeping the "open a 33 MB / 69-sheet
> workbook instantly" performance. Written 2026-07-07.

## The core problem & the fix
Native footer tabs + rename/duplicate/colour/hide/move all require Univer to KNOW
about every sheet — but handing it all 69 sheets' data froze the tab at ~5 MB.

**Shell workbook** (`src/core/shell-workbook.ts`, `buildShellWorkbook`): build ONE
workbook where every sheet is in `sheetOrder` (so all tabs render) but only the
ACTIVE sheet carries cellData/styles/resources; the rest are lightweight shells
(id, name, dims, tab colour, hidden flag, empty cells). Switching tabs re-hydrates.

Only one sheet's styles live in the workbook at a time → per-sheet style ids can't
collide. Fidelity == rendering a single-sheet snapshot (the proven path): merges,
images, CF, filters, hyperlinks all come through.

## What changed (FE — this pass, shipping)
| Area | Before (PoC) | After (product) |
|---|---|---|
| Route | `/?poc` | **`/`** (default); `?poc` + `?legacy` kept |
| Tabs | custom top strip | **native Univer footer tabs** (all sheets) |
| Sheet ops | none | **rename · duplicate · colour · hide · move · delete** (SheetTabMenu) |
| Cells | read-only feel | **editable** (Univer default) |
| Loading | 1 workbook/sheet | shell workbook + lazy hydrate on tab click |
| Edits/renames | lost on tab switch | **preserved in-session** (`captureLive` reads the live workbook back into cache + manifest before each rebuild) |
| Fonts | serif fallback | Calibri→Carlito etc. (office-fonts.css) |

Files: `src/core/shell-workbook.ts` (new, exported), `demo/product-app.tsx` (new
product view), `demo/main.tsx` (default → ProductApp), `scripts/xlsx-poc.mjs`
(manifest now carries `tabColor`/dims for shells).

### How a tab switch works
1. User clicks a footer tab. A capture-phase listener reads `data-id` (ignores the
   `▴` caret, which opens the tab menu).
2. `captureLive()` reads `workbook.getSnapshot()` — persists the current sheet's
   edits into the cache and pulls structural changes (rename/colour/move/hide/
   duplicate) into the manifest.
3. `setActiveId(id)` → rebuild the shell workbook with the clicked sheet hydrated →
   remount. ~10–40 ms/sheet (same as the PoC); revisits are instant (cached).

### Known limitations (fixed by the BE round-trip below)
- **Duplicate/Copy of a not-yet-visited tab** copies an empty shell — visit the tab
  first. Real fix: BE-side duplicate (copy the stored sheet).
- **No persistence across reload** — the demo's "backend" is static `/public` JSON.
  Real fix: point `client` at finsheets-service.

## Backend — Phase 5 edit round-trip (implemented in finsheets-service)
`POST /api/documents/:id/edit  { sheetId, row, column, value? | formula? }`
1. Load the stored `full` workbook (now kept alongside per-sheet snapshots).
2. `applyEdit` (calc.service): load into **headless Univer**, set the cell, run
   `executeCalculation()` over the whole dependency graph (direct + cross-sheet).
3. Diff before/after values → return ONLY changed cells (edited cell + dependents,
   incl. on other sheets).
4. Persist the recomputed workbook; re-split only the touched sheets.

FE consumes the delta and patches cells in place — no full re-fetch. This is the
real fix for the cross-sheet problem (supersedes view-mode formula stripping) and
what makes edits durable + shared.

## Wiring the FE product to the real backend (next)
Swap `client` in `demo/product-app.tsx` (or the host):
```
getManifest: () => GET  /api/documents/:id/manifest
getSheet:    (sid) => GET  /api/documents/:id/sheets/:sid
onEdit:      (op)  => POST /api/documents/:id/edit   → apply returned `changed[]`
```
`buildShellWorkbook` stays identical (backend-agnostic — it just needs a manifest
+ the active sheet's snapshot).

## Sequenced next steps
1. **FE↔BE wiring** — product-app `client` → finsheets-service; edits POST + patch.
2. **BE duplicate/rename/structure ops** — so sheet-tab actions persist server-side
   (fixes the empty-duplicate limitation).
3. **Version History VH-1** (see `VERSION-HISTORY-PLAN.md`) — import→original,
   drawer, read-only preview, View original, Restore, Name/Make-a-copy.
4. **P4 persistence** — schema-per-tenant Prisma store behind the same interface.

## Status
| Piece | State |
|---|---|
| Shell workbook + native tabs + lazy hydrate + in-session edit/rename persistence | ✅ built, `npm run build` + 14 tests pass, `demo:build` OK |
| Default route `/` = product | ✅ |
| Phase 5 edit round-trip (BE) | ✅ implemented; typechecks except 3 not-installed-dep imports (resolve on `npm install`); headless-Univer Facade verify pending |
| FE↔BE wiring | ○ next |
