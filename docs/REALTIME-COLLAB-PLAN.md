# FinSheets — Real-Time Collaboration Plan (Yjs + Hocuspocus)

> Written 2026-07-08. How to add Google-Sheets-style multiplayer (live cursors,
> concurrent editing, presence) to FinSheets **without Univer Pro** — its
> collaboration engine is Pro/unlicensed (Constitution II). We build it on
> **Yjs (MIT)** for the CRDT and **Hocuspocus (MIT)** for transport/persistence.
> This supersedes the "collab phase" note in `VERSION-HISTORY-PLAN.md` §0.

## 0. The problem in one line
Univer edits flow through a **command → mutation** pipeline and its data is a JSON
`IWorkbookData`. To collaborate we must (a) mirror that mutation stream into a
**shared CRDT**, (b) apply remote CRDT changes back as Univer mutations without
echo loops, (c) transport + persist + scale the CRDT, and (d) show who's editing
where. Univer gives us the mutation hooks (free Facade); Yjs gives the CRDT;
Hocuspocus gives the server. The binding in the middle is the work.

## 1. Architecture (layers)

```
┌────────────────────────── Browser (each user) ───────────────────────────┐
│  Univer engine  ⇄  UniverYjsBinding  ⇄  Y.Doc  ⇄  HocuspocusProvider (WS) │
│      │ mutations         │ observe/apply      │ awareness (cursors)        │
│      └── local render     └── y-indexeddb (offline cache)                  │
└──────────────────────────────┬────────────────────────────────────────────┘
                               wss://collab.finopz.ai
┌──────────────────────────────┴──────────────────────────────┐
│  finsheets-collab-service  (Hocuspocus WebSocket server)     │
│   onAuthenticate: cookie-JWT (@fiab/auth) + workspace ACL    │
│   Database ext → Postgres (schema-per-tenant, Y.Doc state)   │
│   Redis ext → cross-instance fan-out (updates + awareness)   │
│   calc-bot: headless Univer recomputes formulas into the doc │
└──────────────────────────────────────────────────────────────┘
```

Two new pieces:
- **FE:** `UniverYjsBinding` + provider wiring + awareness overlay — shipped as an
  **opt-in** subpath (`@levichco/finsheets/collab`) so the base package stays free
  of the WebSocket/Yjs deps for non-collab embeds (Constitution IX/VI).
- **BE:** a **separate** `finsheets-collab-service` (WebSocket, long-lived
  connections — a different scaling profile than the stateless HTTP
  `finsheets-service`). Shares `@fiab/auth`, Postgres, Redis. Subdomain
  `collab.finopz.ai`.

## 2. The Univer ⇄ Yjs binding (the crux)

**Target = state-model CRDT** (not an op-log). Represent the workbook AS Yjs shared
types so concurrent edits to different cells merge cleanly and the persisted state
stays compact:

```
Y.Doc (per document)
├─ meta:      Y.Map { title, sheetOrder: Y.Array<sheetId>, styles: Y.Map }
├─ sheets:    Y.Map<sheetId, sheetSubdoc>          // subdocs, loaded on demand (§6)
│   └─ (subdoc) Y.Map {
│         name, tabColor, hidden, rowCount, columnCount,
│         cells:  Y.Map<"r:c", Y.Map { v, f, s }>,  // one entry per non-empty cell
│         merges: Y.Array<IRange>,
│         rowData/columnData: Y.Map<index, {...}>,
│      }
└─ (awareness carries presence/cursors — NOT in the doc)
```

**Local → remote:** subscribe to Univer's command service (`onCommandExecuted`) for
the mutation types (`SetRangeValuesMutation`, `SetWorksheet* `, `InsertRow/Col`,
`RemoveSheet`, `SetStyle`, merges, tabColor, freeze, …). Each mutation is
translated into a Yjs transaction on the matching shared type, tagged with
`origin = { local: true, userId }`.

**Remote → local:** `Y.Map.observeDeep` on the shared types. On a remote change
(origin ≠ local), translate the delta back into a Univer command executed with a
`{ fromCollab: true }` option so the interceptor **skips re-broadcasting it**
(echo prevention). Same-cell concurrent edits resolve last-writer-wins via Yjs's
Map semantics; different cells/sheets merge with no conflict.

**Why state-model over an op-relay Y.Array:** an op-log grows unbounded, needs
snapshotting to compact, and gives no cell-level merge. The state-model gives
compact persisted state (`Y.encodeStateAsUpdate`) and clean merges — the same
approach `y-prosemirror`/`y-quill` use for their editors.

**Scope discipline (finance-first):** cover **values, formulas, cell styles,
merges, row/col insert-delete, sheet add/remove/rename/reorder/colour/hidden,
freeze** — that's ~95% of finance editing. Rarer resources (drawings, CF rules,
filters, data-validation) sync as a v2 add-on; until then they're owned by
whoever last saved (coarse).

## 3. Formula recompute in a shared doc — the calc-bot
Univer's formula engine runs **client-side**, so each client recomputes locally
after applying a remote edit. Two gaps break that in our product:
1. **Lazy shell-workbook** — a client has only the active sheet loaded, so a
   cross-sheet formula referencing an unopened sheet can't recompute.
2. **Divergence** — different clients with different loaded sheets could compute
   different results.

**Fix: a server-side calc-bot.** `finsheets-collab-service` runs a **headless
Univer** instance that joins each active document as a Yjs client. It observes
value/formula changes, recomputes the **full dependency graph** (the same
`computeWorkbook`/`applyEdit` we already built in `finsheets-service`), and writes
the computed `v`s back into the Y.Doc. Every client then receives authoritative
computed values through the same CRDT. Formulas (`f`) are user-authored and sync
peer-to-peer; computed values (`v`) are authored by the bot. Debounced + gated by
the existing `withCalcGate` concurrency limiter.

## 4. Presence, cursors & selections (awareness)
Yjs **awareness** (rode over the same WS via Hocuspocus) carries, per user:
`{ userId, name, colour, activeSheetId, selection: IRange, cursor: {r,c} }`.
- **Presence bar** — avatars of who's in the document (root awareness).
- **Live cursors/selections** — render each remote user's selection as a coloured
  outline + a name flag on the grid. Univer Pro has this natively; we build a
  lightweight **DOM/canvas overlay** driven by awareness (position derived from the
  active sheet's scroll + cell geometry via the Facade). Only render peers on the
  **same sheet** as you.
- Colours assigned per userId (stable hash), matching the version-history author dots.

## 5. Auth & multi-tenancy (Constitution IV)
Hocuspocus `onAuthenticate(data)`:
1. Read the `access_token` cookie from the upgrade request; verify with `@fiab/auth`
   (same JWT path as REST).
2. Document name = **`${workspaceId}:${documentId}`**. Reject if the token's
   workspace ≠ the doc's workspace (never trust a client-supplied workspace).
3. Resolve the user's role → set the connection **read-only** for VIEWER (edits
   rejected server-side, awareness still shown). Return `{ user }` as connection
   context (used for update attribution + audit).
Buffered pre-auth messages are bounded by Hocuspocus (memory-DoS guard).

## 6. Lazy loading + big workbooks — Yjs subdocuments
Our product opens 33 MB / 69-sheet workbooks by hydrating **one sheet at a time**.
Syncing the whole Y.Doc would defeat that. Use **Yjs subdocuments**: the root doc
holds only `meta` (title + `sheetOrder` + names/colours/hidden) and a `sheets`
`Y.Map<sheetId, Y.Doc>` of **subdoc handles**; each sheet's `cells` live in its own
subdoc that the provider **loads on tab-open and unloads on leave**. Sync bandwidth
is proportional to *opened* sheets, not the whole book. The calc-bot loads the
subdocs a formula's dependency graph actually touches.

## 7. Persistence & version history (unifies with VERSION-HISTORY-PLAN)
- **Live state:** Hocuspocus **Database extension** → `onLoadDocument` /
  `onStoreDocument` (debounced) persists each Y.Doc's `encodeStateAsUpdate` into a
  workspace-schema table `finsheets_ydoc(document_id, sheet_id?, state bytea,
  updated_at)`. This becomes the source of truth for the live doc.
- **History:** the existing `finsheets_version` snapshots become **Yjs state
  snapshots** (`kind` unchanged: import/auto/named/restore). Named version = capture
  `encodeStateAsUpdate` at that moment; **restore** = apply that snapshot as a new
  Yjs update (non-destructive — the timeline only grows). Yjs's update log gives the
  fine-grained "changeset" history the target design wanted; attribution comes from
  each update's `origin.userId`. The FE VH drawer/diff we already built is reused —
  it just reads snapshots that are now Yjs-derived.
- **Offline:** `y-indexeddb` provider caches the doc locally; edits made offline
  merge on reconnect (CRDT, no conflicts), attributed to the author (server-clock
  timestamp on reconnect).

## 8. Scaling
- **Redis extension** for horizontal scale: N `finsheets-collab-service` instances
  behind a WS load balancer; Redis pub/sub broadcasts Y-updates + awareness so
  clients on different instances stay in sync (no sticky sessions needed). Redis is
  **fan-out only** — the Database extension is what persists (they're complementary).
- Calc-bot runs as its own worker pool (CPU-heavy headless Univer), gated by
  `FINSHEETS_MAX_CONCURRENT_CALC`, one bot per active document (leader-elected via
  Redis so only one instance runs a given doc's bot).

## 9. Deps & licensing (all free — Constitution II/VII)
- `yjs` (MIT), `@hocuspocus/server` + `@hocuspocus/extension-database` +
  `@hocuspocus/extension-redis` (MIT), `@hocuspocus/provider` + `y-indexeddb` (MIT).
- **No `@univerjs-pro/*`.** We touch only the free Facade/command service.
- FE collab deps live behind the opt-in `@levichco/finsheets/collab` subpath so the
  base package's peer/runtime deps are unchanged.

## 10. Phasing (build order)
- **RC-0 — Spike (proof):** bind a *single sheet's cell values* Univer⇄Yjs across two
  browsers via a local Hocuspocus. Prove mutation interception + apply-remote + echo
  prevention. This de-risks the whole plan; do it first.
- **RC-1 — Core sync:** full state-model binding (values/formulas/styles/merges/
  structure) + `finsheets-collab-service` (auth + Postgres persistence, single
  instance) + presence bar.
- **RC-2 — Cursors + calc:** live selection/cursor overlays (awareness) + the
  server calc-bot for cross-sheet/heavy formulas.
- **RC-3 — Scale + history + offline:** Redis fan-out, Yjs subdocuments for lazy
  sheets, version-history on Yjs snapshots, `y-indexeddb` offline + reconnect.

## 11. Risks & open questions
- **Biggest risk — the binding.** No free official Univer⇄Yjs binding exists
  (Univer's is Pro OT, not Yjs). Building a faithful two-way binding for every edit
  type is the real effort. Mitigation: RC-0 spike; ship value/formula/style first,
  add structural ops incrementally; keep rare resources coarse-grained initially.
- **Mutation surface parity** — confirm the free command service lets us both
  intercept AND replay every needed mutation with a "fromCollab" origin (it does for
  the core set; verify per Univer 0.25.0).
- **Undo/redo in multiplayer** — Univer's local undo stack vs `Y.UndoManager`; scope
  undo to the local user's own changes (Yjs UndoManager with a tracked origin).
- **Computed-value authority** — formulas peer-synced, `v`s bot-authored; guard
  against a client's stale local recompute overwriting the bot (mark bot writes,
  clients don't broadcast recomputed `v`s).
- **Snapshot ↔ Yjs migration** — existing JSON snapshots (VH-1/2) seed the initial
  Y.Doc via `applyUpdate(encodeStateFromSnapshot)`; a one-time converter.

## 12. Why this fits FinSheets
Reuses everything already built: the **snapshot** shape, the **headless-Univer
calc** (`computeWorkbook`/`applyEdit`) as the calc-bot, the **version-history**
drawer/diff (now Yjs-backed), **schema-per-tenant** + `@fiab/auth` + Redis, and the
**lazy shell-workbook** (now Yjs subdocs). Collaboration is an additive layer — a
binding + a WS service — not a rewrite. And it stays 100% on the free tier.

Sources: Univer collaboration is a Pro offering (dream-num/univer); Yjs
(github.com/yjs/yjs); Hocuspocus hooks/Redis/scalability (tiptap.dev/docs/hocuspocus).
