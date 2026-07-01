# Changelog

All notable changes to `@levich/univer-sheets` are documented here. The package
follows semantic versioning. Each release records the **exact Univer engine
version** it bundles, so a given package version is reproducible and any release
can be rolled back to (see constitution Principle VIII).

## [Unreleased]

### Added
- Initial package scaffold and Spec Kit feature `001-univer-levich-sheets`.
- Core: `LevichSheet` component, workbook compiler, Univer lifecycle, full-fidelity
  ExcelJS export, configurable freeze/locked-columns, comments + width hooks,
  free pivot engine, Levich theme, and the `TransactionSheet` preset.

### Engine
- Univer (`@univerjs/presets`, `@univerjs/preset-sheets-core`): **0.25.0** (exact pin)
- ExcelJS: **4.4.0**

---

## Release / rollback procedure

1. To adopt a new Univer version: change the exact pin in `package.json`, run
   `npm run build` and `npm run test`, record the new engine version here, then
   tag the release.
2. To roll back: pin the previous package version (or check out the previous tag
   while locally linked). Because the engine version is pinned exactly, the prior
   behavior is restored exactly.
