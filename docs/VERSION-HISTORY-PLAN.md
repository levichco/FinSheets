# FinSheets — Version History: Detailed Implementation Plan

> Written 2026-07-07. Replicates **Google Sheets version history exactly** (clock
> icon → right drawer, day-grouped versions, Current version, View original, Name
> this version, Make a copy, Restore, Highlight changes / Show unmodified rows,
> per-sheet diffs). v1 stack = **PostgreSQL + Redis + IndexedDB** (Yjs/Hocuspocus
> deferred — see `VERSION-HISTORY.md`). We build it ourselves on JSON snapshots
> (Univer free tier has no history plugin; `@univerjs-pro/edit-history` is
> unlicensed — Constitution II). Backend = `finsheets-service`.

## 1. Logical model — the UX (Google-Sheets exact)

### Trigger
- **Clock icon (↺)** in the FinSheets header/toolbar → opens the right **Version
  history** drawer (main grid goes read-only "preview" mode).

### The drawer
- Header: `← Version history`, current-version title (e.g. "4 July, 18:19").
- **`All versions ▾`** filter: *All versions* | *Named versions only*.
- **Versions grouped by day** ("Today", "Yesterday", "Saturday", explicit dates).
- Each entry:
  - **timestamp** ("4 July, 18:19"), **author** (colored dot + name),
  - **"Current version"** badge on the newest,
  - the **original** import version shows **"Imported .xlsx file"** + a blue
    **"View original"** link,
  - a **`>` expander** — a top-level version expands to the finer auto-saves rolled
    into it (grouping; v1 can ship flat, add grouping later),
  - a **`⋮` menu** → **Name this version** · **Make a copy**.
- Bottom: **☑ Highlight changes** · **☐ Show unmodified rows**.
- Top-right of the preview: **`Total: N edits`** + up/down to step between versions.

### Selecting a version (preview)
- Main grid renders that version **read-only**; banner shows the timestamp +
  **[Restore this version]** button.
- **Per-sheet diff:** switching sheet tabs shows that sheet at that revision. If the
  sheet is unchanged in the revision → the **"No changes to this sheet in this
  revision"** empty state; otherwise **changed cells are highlighted**.
- **Highlight changes** toggles the diff highlight. **Show unmodified rows**
  collapses rows with no change (default: show only changed rows + context).

### Actions
- **Restore this version** — NON-destructive: writes a *new* version
  (`kind: restore`) set as current; the timeline only grows.
- **Name this version** — modal → label; named versions kept forever.
- **Make a copy** — new document from that version's full state.
- **View original** — jumps to the immutable `kind: import` snapshot.

## 2. What a version is
A version = a **document-level checkpoint** = the full `IWorkbookData` snapshot
(all sheets: computed values + formulas + styles + resources) at a moment, plus
metadata. Diffs are shown **per-sheet** (like Google), computed by comparing two
checkpoints. v1 uses **coarse checkpoints** (no per-keystroke changeset log) —
Google-Docs-versions granularity.

## 3. Checkpoint triggers (when a version is cut)
| Trigger | Kind | Notes |
|---|---|---|
| On **import** | `import` | The immutable "Imported .xlsx file" — **View original** points here. |
| On **edit** (needs Phase 5 edit round-trip) | `auto` | Debounced: after **N min of activity** (e.g. 10), **M ops** (e.g. 200), on **idle**, or **last editor leaves**. |
| **Name this version** | `named` | Kept forever. |
| **Restore** | `restore` | "Restored from <ts>". |
| **Make a copy** | (new doc) | Not a version of the source. |

## 4. Storage layers (Postgres + Redis + IndexedDB)
- **PostgreSQL** = source of truth. Per-workspace schema (Constitution IV).
  `finsheets_version` rows hold the checkpoint blob + metadata. Append-only;
  timeline only grows.
- **Redis** = hot cache: the version LIST per document, the head snapshot, and
  **computed per-sheet diffs** (so re-opening the drawer is instant; diffs aren't
  recomputed).
- **IndexedDB** (client) = instant local autosave + **offline** buffer; caches
  recently-viewed versions for instant preview; offline edits merge on reconnect
  and appear in history attributed to their author (timestamp = reconnect time,
  server clock — v1 decision).

## 5. Data model (workspace schema)
```prisma
model finsheets_version {
  id           String   @id @default(uuid())
  document_id  String
  seq          Int                    // monotonic order
  state_blob   Bytes                  // gzip'd full IWorkbookData snapshot
  label        String?                // null = auto; set = named
  kind         String   @default("auto") // import | auto | named | restore
  author_id    String
  authors      Json?                  // contributors since previous version
  created_at   DateTime @default(now())
  @@unique([document_id, seq])
  @@index([document_id, created_at])
}
// finsheets_document.head_version_id → current version.
// The kind='import' version (seq 0) is the "original" (View original).
```
Blob size control (from the render-engine work): reuse the empty-styled-cell
collapse + per-sheet split so a checkpoint isn't the full 33 MB — store per-sheet
sub-blobs, fetch the previewed sheet lazily.

## 6. Diff engine ("Highlight changes")
- **Per-sheet, cell-level.** Compare sheet S in version A vs the previous version:
  for each cell, compare `{v, f, s}`. A change (value/formula/style) → the cell is
  in the **changed set**.
- **"No changes to this sheet in this revision"** = the sheet's changed set is
  empty (identical cellData between the two checkpoints).
- **Highlight** = inject a highlight background/border into the changed cells'
  style in the *preview* snapshot before rendering (no new Univer plugin needed —
  it's just styled cells in a read-only render).
- **Show unmodified rows** = when off, drop rows whose entire row has no changed
  cell (keep a little context), like Google.
- Diffs are **lazy per-sheet** (only the sheet you're viewing) and **cached in
  Redis** keyed by `(documentId, versionA, versionB, sheetId)`.

## 7. API surface (`finsheets-service`, tenant-scoped)
```
GET  /documents/:id/versions
       → grouped list: [{ id, seq, label, kind, author, authors, created_at,
                          isOriginal, isCurrent }]  (day-grouping done on FE)
GET  /documents/:id/versions/:vid/sheets/:sid
       → one sheet's snapshot AT that version (lazy preview)
GET  /documents/:id/versions/:vid/diff/sheets/:sid
       → changed-cell set for that sheet vs the previous version (highlight)
POST /documents/:id/versions            { label? }   → name / cut a checkpoint
POST /documents/:id/versions/:vid/restore            → non-destructive restore
POST /documents/:id/versions/:vid/copy               → new document from snapshot
GET  /documents/:id/original                          → the import version (View original)
```
All under `authMiddleware`; audit-log restore + named-version (Constitution).

## 8. FE package integration (`@levich/univer-sheets`)
New, opt-in, host-wired (keeps the package render-only + browser-only):
- **Clock-icon trigger** in `LevichToolbar` → opens the drawer.
- **`<VersionHistoryDrawer>`** component (right drawer) — renders the grouped list,
  `All versions` filter, `⋮` (Name / Make a copy), `View original`, `Restore`,
  `Highlight changes` / `Show unmodified rows`, `Total: N edits` nav.
- **Read-only preview mode** on `LevichSheet` (render a supplied snapshot without
  accepting edits) — already flagged as needed.
- **Diff highlight overlay** — apply the changed-cell highlight to the preview
  snapshot; per-sheet, lazy.
- **Host callbacks** (so the host wires them to the `finsheets-service` API):
  `listVersions`, `previewVersion(vid, sheetId)`, `diffSheet(vid, sheetId)`,
  `nameVersion(vid, label)`, `makeCopy(vid)`, `restoreVersion(vid)`,
  `viewOriginal()`.

## 9. Retention (Google-Docs-like, per workspace, configurable)
- **Named versions** → kept forever.
- **Auto versions** → keep every checkpoint for 24h, then hourly for a week, then
  daily. Prune the rest. Blob compaction once superseded.

## 10. Permissions & guardrails (Constitution II/IV)
- **View history** = view rights on the doc (workspace role ≥ VIEWER).
- **Restore / Name / Make a copy** = edit rights (≥ MEMBER, or Flux-drill
  Preparer/Reviewer — fail-closed).
- Tenant isolation: versions live in the workspace schema; never cross-workspace.
- Audit-log every restore + named version.

## 11. Phasing
- **VH-1 (can ship before edit round-trip):** import → `kind:import` original;
  version-list drawer (from imports/manual checkpoints); read-only preview;
  **View original**; **Restore**; **Name this version**; **Make a copy**.
- **VH-2 (needs Phase 5 edit round-trip):** **auto-checkpoints on edit** (debounced
  triggers); the **diff engine** (Highlight changes / Show unmodified rows);
  `Total: N edits` grouping/expander.
- **VH-3 (later, collab phase):** swap snapshot blobs to Yjs state; per-user
  attribution via Hocuspocus; live presence.

## 12. Why this fits FinSheets cleanly
- Reuses the **snapshot** we already produce (`getSnapshot()` / import converter)
  and the **per-sheet split + lazy loading** — a version is just a stored snapshot,
  previewed one sheet at a time.
- Reuses **schema-per-tenant** (isolation), **Redis** (`@fiab/redis`), and the
  `finsheets-service` we scaffolded — `finsheets_version` is already in its Prisma
  schema.
- No Univer Pro, no new engine — pure data + a drawer + read-only preview.
