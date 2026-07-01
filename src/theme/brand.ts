/**
 * Levich brand color — the single source of truth, with NO engine imports so it
 * can be exported from the public barrel without eagerly pulling in Univer
 * (constitution Principles V + IX).
 */

/** Levich primary (brand) color scale. The 600 step is the core brand color. */
export const levichPrimary = {
  50: "#f1eefc",
  100: "#e3ddf9",
  200: "#c7bbf3",
  300: "#a999ec",
  400: "#8b77e6",
  500: "#6d55df",
  600: "#4a32c3",
  700: "#3a279c",
  800: "#2b1d75",
  900: "#1d134e",
} as const;

/** The core Levich brand color. */
export const LEVICH_BRAND: string = levichPrimary[600];
