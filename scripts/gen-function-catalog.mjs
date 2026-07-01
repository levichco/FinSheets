/**
 * Generate src/features/function-catalog.generated.ts from Univer's formula
 * catalog (@univerjs/sheets-formula). Run: node scripts/gen-function-catalog.mjs
 */
import fs from "fs";

const bundle = fs.readFileSync("node_modules/@univerjs/sheets-formula/lib/es/index.js", "utf8");
const loc = (await import("@univerjs/sheets-formula/lib/es/locale/en-US.js")).default;
const fl = loc["sheets-formula"].functionList;

const LABEL = {
  FINANCIAL: "Financial", DATE: "Date", MATH: "Math", STATISTICAL: "Statistical",
  LOOKUP: "Lookup", DATABASE: "Database", TEXT: "Text", LOGICAL: "Logical",
  INFORMATION: "Info", ENGINEERING: "Engineering", CUBE: "Cube",
  COMPATIBILITY: "Compatibility", WEB: "Web", ARRAY: "Array", UNIVER: "Univer",
};
const ORDER = ["Math", "Statistical", "Financial", "Logical", "Lookup", "Text", "Date", "Array", "Engineering", "Database", "Info", "Web", "Compatibility", "Cube", "Univer"];

const cats = {};
const re = /const FUNCTION_LIST_([A-Z]+) = \[([\s\S]*?)\n\];/g;
let m;
while ((m = re.exec(bundle))) {
  const cat = LABEL[m[1]];
  if (!cat) continue;
  const names = [...m[2].matchAll(/functionList\.(.+?)\.abstract"/g)].map((x) => x[1]);
  cats[cat] = [...new Set(names)];
}

const out = ORDER.filter((c) => cats[c] && cats[c].length).map((cat) => ({
  category: cat,
  fns: cats[cat].map((name) => ({ name, hint: String(fl[name]?.abstract || fl[name]?.description || "").slice(0, 80) })),
}));

const total = out.reduce((s, c) => s + c.fns.length, 0);
const header = [
  "/**",
  " * AUTO-GENERATED from Univer's formula catalog (@univerjs/sheets-formula).",
  " * Do not edit by hand. Regenerate: node scripts/gen-function-catalog.mjs",
  ` * ${total} functions across ${out.length} categories — every one is evaluated`,
  " * by Univer's engine when typed (=NAME(...)).",
  " */",
  "export interface CatalogFn { name: string; hint: string }",
  "export interface CatalogCategory { category: string; fns: CatalogFn[] }",
  `export const FULL_FUNCTION_CATEGORIES: CatalogCategory[] = ${JSON.stringify(out, null, 2)};`,
  "",
].join("\n");

fs.writeFileSync("src/features/function-catalog.generated.ts", header);
console.log("wrote", total, "functions,", out.length, "categories:", out.map((c) => `${c.category}(${c.fns.length})`).join(", "));
