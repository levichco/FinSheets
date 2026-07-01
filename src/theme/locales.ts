/**
 * Levich locale overrides merged on top of the Univer English locale.
 * Used to rename visible engine labels to match our product wording.
 *
 * IMPORTANT: Univer's `mergeLocales` is a SHALLOW `Object.assign`, so handing it
 * a partial `{ "sheets-filter-ui": { panel: {...} } }` would REPLACE the whole
 * `sheets-filter-ui` object and drop every sibling key (showing raw codes like
 * `sheets-filter-ui.conditions.none`). We therefore deep-merge these overrides
 * onto the base locale ourselves via `deepMergeLocales` (see create-sheet.ts).
 */
export const levichLocale: Record<string, unknown> = {
  // Filter funnel panel — match Google Sheets wording.
  "sheets-sort-ui": {
    general: {
      "sort-asc": "Sort A to Z",
      "sort-desc": "Sort Z to A",
      "sort-asc-cur": "Sort A to Z",
      "sort-desc-cur": "Sort Z to A",
      "sort-asc-ext": "Sort A to Z",
      "sort-desc-ext": "Sort Z to A",
    },
  },
  "sheets-filter-ui": {
    panel: {
      "by-values": "Filter by values",
      "by-colors": "Filter by colour",
      "by-conditions": "Filter by condition",
      "filter-by-color-none": "The column contains only one colour",
      "clear-filter": "Clear",
      cancel: "Cancel",
      confirm: "OK",
      "select-all": "Select all",
      "filter-only": "Filter only",
      empty: "(empty)",
      "search-placeholder": "Search",
    },
    conditions: {
      none: "None",
      empty: "Is empty",
      "not-empty": "Is not empty",
      "text-contains": "Text contains",
      "does-not-contain": "Text does not contain",
      "starts-with": "Text starts with",
      "ends-with": "Text ends with",
      equals: "Text is exactly",
      "greater-than": "Greater than",
      "greater-than-or-equal": "Greater than or equal to",
      "less-than": "Less than",
      "less-than-or-equal": "Less than or equal to",
      equal: "Is equal to",
      "not-equal": "Is not equal to",
      between: "Is between",
      "not-between": "Is not between",
      custom: "Custom formula",
    },
  },
};

type LocaleTree = Record<string, unknown>;

/**
 * Recursively merge `override` onto `base`, returning a new object. Plain-object
 * values merge key-by-key; everything else (strings, arrays) is overwritten.
 * Use this instead of Univer's shallow `mergeLocales` when layering partial
 * overrides so sibling keys are preserved.
 */
export function deepMergeLocales(base: LocaleTree, override: LocaleTree): LocaleTree {
  const out: LocaleTree = { ...base };
  for (const key of Object.keys(override)) {
    const o = override[key];
    const b = out[key];
    if (isPlainObject(o) && isPlainObject(b)) {
      out[key] = deepMergeLocales(b as LocaleTree, o as LocaleTree);
    } else {
      out[key] = o;
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is LocaleTree {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
