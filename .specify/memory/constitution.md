<!--
  Sync Impact Report
  ==================
  Version change: (new) → 1.0.0 (initial ratification for the Univer_Levich library)
  Rationale: Replaces the inherited fiab-ui (React application) constitution with a
    constitution scoped to @levich/univer-sheets — a reusable, browser-only,
    Levich-branded spreadsheet PACKAGE that wraps the free Apache-2.0 Univer engine.
  Principles defined: I Wrapper-Not-Fork · II Free-Tier-Only · III Full-Fidelity
    Export Contract · IV Consumer-Driven Layout · V Clean Public Boundary ·
    VI Single React Instance · VII License Compliance · VIII Reproducible &
    Reversible Releases · IX Browser-Only & Lazy-Loaded.
  Templates reviewed: plan-template.md (Constitution Check gate) ✓ ,
    spec-template.md ✓ , tasks-template.md ✓ — compatible.
  Follow-up TODOs: none.
-->

# Univer Levich Sheets Constitution

`@levich/univer-sheets` — a reusable, embeddable, fully Levich-branded spreadsheet
package that wraps the free (Apache-2.0) Univer engine for use in any website.

## Core Principles

### I. Wrapper, Not Fork
The package MUST consume Univer as an upstream dependency, never vendor or fork its
engine source. The Univer version MUST be pinned to an EXACT version (no range
operators) so a given package version always resolves the same engine. Upstream
upgrades are deliberate, version-gated events — never silent.
*Rationale:* keeps the maintained surface small (the Levich glue, not 50+ engine
packages) and makes rollback deterministic.

### II. Free-Tier Only
The package MUST use only Apache-2.0 Univer capabilities. Paid/commercial Univer
plugins (Pro charts, Pro pivot, the exchange importer, collaboration/server) MUST
NOT be introduced. Capabilities that would require them (e.g. native charts) are
out of scope or re-implemented independently with free libraries.
*Rationale:* the product premise is zero per-seat licensing cost.

### III. Full-Fidelity Export Contract (NON-NEGOTIABLE)
Export MUST serialize the LIVE on-screen state — every user edit, comment, and
computed result — and MUST preserve visual fidelity: colors/fills, number formats,
bold/text styling, borders, alignment, merged cells, column widths, and frozen
panes. "Download exactly what you see" is a hard contract and MUST be covered by a
fidelity test. A values-only export (which silently drops styling) is FORBIDDEN as
the default path.
*Rationale:* an explicit, repeatedly-stated product requirement.

### IV. Consumer-Driven Layout
No layout may be hard-coded. Columns, headers, freezing, locked/read-only columns,
and formatting MUST be driven by consumer configuration with overridable defaults.
Any opinionated arrangement (e.g. the transaction view) ships as an optional
preset, never as the baseline.
*Rationale:* the package is general-purpose; one consumer's layout must not bind
another's.

### V. Clean Public Boundary
Consumers MUST interact only through the documented public API (the exported
component(s), presets, types, and helpers). Univer internals MUST NOT leak across
the boundary. The public surface is intentional and reviewed; anything not exported
from the package entry point is private.
*Rationale:* keeps branding consistent and lets the engine evolve behind a stable
contract.

### VI. Single React Instance
React and React-DOM MUST be declared as peerDependencies and MUST NOT be bundled.
The package MUST function with one React instance provided by the host. Build
configuration MUST externalize React (and the host MUST dedupe it).
*Rationale:* two React copies are the classic wrapper-package failure ("invalid
hook call").

### VII. License Compliance
The package MUST ship an Apache-2.0 `LICENSE` and a `NOTICE` attributing Univer,
from the first release. Redistribution without the required attribution is
FORBIDDEN.
*Rationale:* legal precondition for redistributing Apache-2.0 work.

### VIII. Reproducible & Reversible Releases
Releases MUST follow semantic versioning; each released version MUST be immutable
and independently installable. Because the engine is pinned exactly (Principle I),
rolling back the package version MUST restore the exact prior behavior. Every
release MUST record the engine version it carries.
*Rationale:* a shared package must never trap a consumer on a bad version.

### IX. Browser-Only & Lazy-Loaded
The package targets the browser; server-side/headless file generation is out of
scope for this version. The (large) engine runtime MUST be lazy-loadable so it
stays out of the host application's main bundle until a sheet is opened.
*Rationale:* matches the consumption model and protects host load performance.

## Additional Constraints

- **Scope boundary (this version):** opening/importing existing spreadsheet files,
  interactive drag-and-drop pivot building, embedded images, charts, and
  server-side generation are OUT OF SCOPE. Pivots are computed from in-memory data
  via configuration only.
- **Performance:** rendering MUST remain smooth for large datasets (target: 20k+
  rows without visible lag), leveraging the engine's canvas rendering.
- **Distribution:** initial adoption is via local linking (`file:`); publishing to
  a registry is a later, deliberate step.

## Development Workflow

- All feature work MUST follow the Spec Kit flow: `specify → plan → tasks →
  analyze (→ implement)`, with artifacts under `specs/<feature>/`.
- The Constitution Check gate in `plan.md` MUST pass (or record justified
  exceptions in Complexity Tracking) before and after design.
- Changes that touch the public API or the export contract MUST be called out
  explicitly in the plan and verified by tests.

## Governance

This constitution supersedes the inherited application constitution for the
Univer_Levich repository. Amendments require updating this file with a version bump
and a Sync Impact Report. Versioning of this document follows semantic versioning:
MAJOR for principle removals/redefinitions, MINOR for new principles/sections,
PATCH for clarifications. Compliance is reviewed at each Spec Kit `plan` and
`analyze` step.

**Version**: 1.0.0 | **Ratified**: 2026-06-29 | **Last Amended**: 2026-06-29
