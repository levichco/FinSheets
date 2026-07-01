# Feature Specification: Univer Levich Sheets — Embeddable Branded Spreadsheet Package

**Feature Branch**: `001-univer-levich-sheets`
**Created**: 2026-06-29
**Status**: Draft
**Input**: User description: "Reusable Levich-branded spreadsheet package wrapping the free Apache-2.0 Univer engine, embeddable in any website with one component, full WYSIWYG xlsx export, configurable layout and pivot tables"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Embed a branded, interactive spreadsheet (Priority: P1)

An integrating developer adds the package to their website and embeds a single spreadsheet component, passing in their own data and a description of the columns. A fully Levich-branded, interactive spreadsheet appears: rows and columns of their data, a frozen header, editable cells, working formulas, and currency/date/number formatting — without the developer building any spreadsheet machinery themselves.

**Why this priority**: This is the foundation and the minimum viable product. Without the ability to embed and render branded, interactive data, nothing else (export, pivots, presets) has anything to operate on. It alone delivers standalone value: a drop-in spreadsheet.

**Independent Test**: Embed the component on a blank page with a sample dataset and column definitions; confirm a branded, scrollable, editable grid renders with the configured frozen rows, read-only columns, and number/date/currency formatting.

**Acceptance Scenarios**:

1. **Given** a dataset and a set of column definitions, **When** the component is embedded, **Then** a branded spreadsheet renders showing the data under the defined column headers.
2. **Given** a column marked as currency, **When** the sheet renders, **Then** that column displays values in accounting-style currency format.
3. **Given** a configuration that freezes the header row, **When** the user scrolls vertically, **Then** the header remains visible.
4. **Given** a column marked read-only, **When** the user attempts to edit a cell in that column, **Then** the edit is rejected and the original value is preserved.
5. **Given** an editable cell, **When** the user types a value or a formula, **Then** the cell updates and any dependent formula recalculates.

---

### User Story 2 - Download the sheet with full visual fidelity (Priority: P2)

An end user works in the embedded sheet — typing comments, editing values, watching totals compute — then downloads it as an Excel file. The downloaded `.xlsx` is identical to what was on screen: every edit, every color and fill, currency and date formats, bold text, borders, merged cells, column widths, and the frozen header are all preserved.

**Why this priority**: "Download exactly what I see" is a hard requirement and the primary way users take their work out of the product. It is independently valuable once a sheet renders (US1) and is a frequent, explicit expectation for finance workflows.

**Independent Test**: Render a sheet, make several edits (including a typed comment and a value change), download it, open the file in Excel or Google Sheets, and confirm the edits AND the visual formatting (colors, currency/date formats, bold, borders, merged cells, widths, frozen header) are all present.

**Acceptance Scenarios**:

1. **Given** a user has edited cells and typed comments, **When** they download the file, **Then** all edits and comments appear in the downloaded file.
2. **Given** the sheet shows currency formatting, colored headers, and bold totals, **When** the file is opened externally, **Then** those colors, number formats, and bold styling are preserved.
3. **Given** the sheet has merged cells, custom column widths, and a frozen header, **When** the file is opened externally, **Then** those layout properties are preserved.
4. **Given** a cell contains a formula, **When** the file is opened externally, **Then** the computed result is present (and the formula remains live where supported).

---

### User Story 3 - Summarize data with pivot tables (Priority: P3)

An integrating developer supplies a pivot configuration (which fields to group down the side, which to spread across the top, which value to summarize, and how to aggregate). The sheet renders a pivot table — row groups, column groups, subtotals, and a grand total — computed from the supplied data, and that pivot result downloads with the same full fidelity as any other sheet.

**Why this priority**: Pivots add high analytical value but are not required for the core embed-and-export loop. They build on US1/US2 and can ship after them.

**Independent Test**: Supply a dataset plus a pivot configuration; confirm the rendered pivot shows correct group rows/columns, subtotals, and a grand total, and that downloading it preserves the pivot layout and styling.

**Acceptance Scenarios**:

1. **Given** a dataset and a pivot configuration, **When** the sheet renders, **Then** a pivot table appears with the configured row groups, column groups, and aggregated values.
2. **Given** a chosen aggregation (sum, count, average, min, or max), **When** the pivot computes, **Then** the values reflect that aggregation, including correct subtotals and grand total.
3. **Given** a rendered pivot, **When** the user downloads the file, **Then** the pivot result and its styling are present in the file.

---

### User Story 4 - Capture per-row notes that persist (Priority: P3)

An end user adds notes in an editable comment column. The integrating developer is given a hook to persist those notes (to their own storage or API), and previously saved notes are restored when the sheet is reopened. The developer can also persist and restore the user's adjusted column widths.

**Why this priority**: Notes and remembered layout improve real workflows (e.g., reconciliation commentary) but are not required for the core render/export value. Independently testable on top of US1.

**Independent Test**: Type a note in the comment column, confirm the persistence hook fires with the note; reload with previously saved notes and widths supplied, and confirm they are restored.

**Acceptance Scenarios**:

1. **Given** an editable comment cell, **When** the user types and commits a note, **Then** the persistence hook is invoked with the note and its row identity.
2. **Given** previously saved notes are supplied at load, **When** the sheet renders, **Then** those notes appear pre-filled in the comment column.
3. **Given** the user resizes a column, **When** the resize settles, **Then** the width-change hook is invoked; **and** supplied saved widths are applied on the next load.

---

### User Story 5 - Drop in a ready-made transaction sheet (Priority: P4)

An integrating developer who needs the common accounting "account transactions" view uses a ready-made preset that is pre-configured (transaction columns, frozen header, locked ledger (GL) columns, an editable comment column, currency formatting, and a totals row) so they get the standard view with almost no configuration.

**Why this priority**: A convenience layer over US1 that accelerates the most common use case. Valuable but clearly optional and last.

**Independent Test**: Embed the transaction preset with a set of transactions and confirm it renders the standard branded transaction view (locked ledger (GL) columns, editable comments, currency, totals) without further configuration.

**Acceptance Scenarios**:

1. **Given** a set of transactions, **When** the transaction preset is embedded, **Then** the standard transaction view renders with the expected columns, frozen header, locked ledger (GL) columns, editable comment column, currency formatting, and a totals row.

---

### User Story 6 - Adopt and roll back versions safely (Priority: P2)

An integrating developer installs a specific version of the package and pins it. When a new version is released, they choose when to upgrade. If a new version misbehaves, they roll back to the exact previous version and get identical prior behavior.

**Why this priority**: Predictable, reversible adoption is essential for a shared package that many sites depend on; a bad release must never trap a consumer. It is independently verifiable via release/rollback even before pivots/presets exist.

**Independent Test**: Install a pinned version, embed it, confirm behavior; switch to a prior released version and confirm the earlier behavior is reproduced exactly.

**Acceptance Scenarios**:

1. **Given** a pinned package version, **When** the consumer installs it, **Then** they always receive the same rendering behavior for that version.
2. **Given** a newer version causes a problem, **When** the consumer pins back to the previous version, **Then** the previous behavior is fully restored.

---

### Edge Cases

- **Empty dataset**: the sheet renders headers (and any totals/pivot scaffold) with no data rows, without error.
- **Very large dataset**: thousands of rows render and scroll without visible lag, and a full-fidelity export of 20,000 rows completes in under ~10 seconds on a typical modern laptop.
- **Edit on a locked cell**: the attempt is silently rejected and the original value retained.
- **Download before ready**: if a download is requested before the sheet has finished mounting, the action fails safely (no partial/corrupt file) and the user is informed.
- **Unsupported source content**: content types this version does not support (e.g., charts) are excluded cleanly rather than rendering broken artifacts.
- **Rollback**: returning to a prior version restores prior behavior with no residual state from the newer version.
- **Pivot over sparse/missing values**: groups with no matching records show empty/zero per the chosen aggregation, and totals remain correct.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The package MUST expose a single embeddable spreadsheet component that an integrating developer can render with minimal configuration.
- **FR-002**: The component MUST accept arbitrary tabular data plus a set of column definitions and render the data under the defined columns.
- **FR-003**: Column definitions MUST support, at minimum: a header label, a value format (currency, date, number, or text), and flags for read-only and editable.
- **FR-004**: The component MUST support configurable freezing of rows and/or columns, including the option to freeze nothing.
- **FR-005**: The component MUST support marking any chosen columns as read-only; the rest remain editable. Nothing about the layout (columns, freezing, locking) may be hard-coded — all of it is driven by consumer configuration.
- **FR-006**: Users MUST be able to edit editable cells and enter formulas, with dependent values recalculating.
- **FR-007**: The component MUST format currency, date, and number columns according to each column's configured format, keeping underlying values numeric so formulas and export remain correct.
- **FR-008**: The component MUST provide an editable comment capability and a hook that lets the integrating developer persist comment edits and pre-fill previously saved comments.
- **FR-009**: The component MUST remember adjusted column widths via a hook that lets the developer persist and restore them.
- **FR-010**: The component MUST allow exporting the current sheet to a standard spreadsheet file (`.xlsx`).
- **FR-011**: The exported file MUST reflect the live, on-screen state — including all user edits and computed results — not the original input data ("download what you see").
- **FR-012**: The exported file MUST preserve visual fidelity: cell colors/fills, currency/date/number formats, bold and text styling, borders, alignment, merged cells, column widths, and frozen panes.
- **FR-013**: The component MUST support pivot tables defined by configuration (row groups, column groups, summarized value(s), and aggregation method), computed from the supplied data, and rendered within the sheet.
- **FR-014**: Pivot output MUST include subtotals and a grand total and MUST export with the same full fidelity as the rest of the sheet.
- **FR-015**: The rendered spreadsheet MUST be fully Levich-branded by default — the underlying engine's branding must not be visible — with the brand color defined in a single place so it is the default look and adjustable.
- **FR-016**: The package MUST provide a ready-made transaction-sheet preset that renders the standard accounting transaction view without further configuration.
- **FR-017**: Each released version MUST be immutable and independently installable, so consumers can pin a version and reproduce its exact behavior.
- **FR-018**: Consumers MUST be able to roll back to any previously released version and obtain that version's exact prior behavior.
- **FR-019**: The package MUST be redistributable and MUST include the legally required attribution for the underlying open-source engine.
- **FR-020**: The following are explicitly NOT supported in this version and MUST be cleanly excluded (no broken artifacts): opening/importing existing spreadsheet files, interactive drag-and-drop pivot building, embedded images, charts, and server-side file generation. (See Out of Scope.)

### Key Entities *(include if feature involves data)*

- **Sheet Dataset**: the tabular data supplied by the integrating developer — a collection of records with named fields.
- **Column Definition**: describes one on-sheet column — its header, value format, and read-only/editable behavior, plus optional width.
- **Layout Configuration**: consumer-supplied freezing and locked-column choices; never hard-coded.
- **Comment**: a per-row, user-entered note tied to a stable row identity, persisted via the developer's hook.
- **Pivot Configuration**: the row groups, column groups, summarized value(s), and aggregation method used to compute a pivot.
- **Exported File**: a standard spreadsheet file representing the live sheet with full visual fidelity.
- **Theme**: the Levich brand appearance (notably the brand color) applied by default.
- **Package Release**: an immutable, installable version of the package whose behavior is reproducible and roll-back-able.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An integrating developer can embed a working, branded spreadsheet showing their own data in under 15 minutes from a standing start, using only the package's public component and documentation.
- **SC-002**: 100% of a user's on-screen edits, comments, and computed results are present in the downloaded file.
- **SC-003**: 100% of on-screen visual formatting that the version supports — colors/fills, currency/date/number formats, bold, borders, merged cells, column widths, frozen panes — is preserved in the downloaded file when opened in a standard spreadsheet application.
- **SC-004**: A sheet of at least 20,000 rows renders and scrolls without visible lag on a typical modern laptop.
- **SC-005**: A pivot configuration produces correct group totals, subtotals, and grand total verifiable against a manual calculation for a sample dataset.
- **SC-006**: Nothing identifiable as the underlying engine's branding is visible in the default rendered sheet (verified by visual inspection).
- **SC-007**: A consumer can pin a version and, after a problematic upgrade, restore the prior behavior by rolling back, with zero behavioral difference from the original pinned version.
- **SC-008**: A reviewer can confirm the package ships the required open-source attribution for the underlying engine.
- **SC-009**: A full-fidelity export of a 20,000-row sheet completes in under ~10 seconds on a typical modern laptop.

## Assumptions

- The package is consumed in a website/browser context; there is no server-side file generation in this version.
- The integrating developer owns any persistence (comments, widths) via the provided hooks; the package itself does not mandate a storage backend.
- Pivot tables are computed from the data supplied to the component, not reconstructed from a pre-existing file's internal pivot definition.
- "Full fidelity" export covers the visual features this version supports; excluded content (charts, images, pivots-from-files) is out of scope and not expected in the file.
- A single brand theme (Levich) is the default; making the theme consumer-overridable is desirable but not required for this version.
- The rendered sheet supports standard spreadsheet editing and formulas as provided by the underlying engine's free capabilities.

## Out of Scope (this version)

- Opening or importing existing spreadsheet files supplied by the user.
- Interactive drag-and-drop pivot building (configuration-based pivots only).
- Embedded images and charts.
- Server-side / headless file generation.
- Real-time multi-user collaboration and edit history.
- Publishing to a public package registry (initial adoption is via local linking; public/private publishing is a later step).
