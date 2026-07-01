import { defineConfig } from "tsup";

/**
 * Library build for @levich/univer-sheets.
 *
 * - ESM only (modern hosts: Vite/Webpack 5).
 * - Emits .d.ts type declarations.
 * - Bundles our CSS (Univer core CSS + Levich overrides) into dist/index.css,
 *   exposed via the package "./styles.css" subpath.
 * - Externalizes react, react-dom, @univerjs/* and exceljs so they resolve from
 *   the consumer's node_modules (tiny bundle; single React instance — see the
 *   constitution, Principle VI).
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Ship CSS as a separate file rather than injecting at runtime.
  injectStyle: false,
  external: ["react", "react-dom", "react/jsx-runtime", "exceljs", "@untitledui/icons", /^@univerjs\//],
});
