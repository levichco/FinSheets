/**
 * Levich brand theme for Univer. Built by spreading Univer's default theme and
 * overriding the `primary` scale, so the rendered sheet is FinOpz-branded by
 * default. Univer drives its native primary buttons (Confirm, etc.), focus rings
 * and selection chrome from `primary.600`; FinOpz uses a near-black CTA, so we
 * map the primary scale to our neutral-dark palette (black CTAs, not the default
 * blue or the Levich purple). The brand color itself lives in the engine-free
 * `brand.ts`; this module is internal and is NOT re-exported from the public
 * barrel (it carries a Univer `Theme` type).
 */
import { defaultTheme, type Theme } from "@univerjs/presets";
import { LEVICH_BRAND, levichPrimary } from "./brand";

/** FinOpz primary scale — `600` is the black CTA used by Univer's buttons. */
const finopzPrimary = {
  50: "#f2f4f7",
  100: "#eaecf0",
  200: "#d0d5dd",
  300: "#98a2b3",
  400: "#475467",
  500: "#1d2939",
  600: "#101828",
  700: "#0a0a0a",
  800: "#000000",
  900: "#000000",
} as const;

/** The Levich Univer theme (default theme with the FinOpz black primary scale). */
export const levichTheme: Theme = {
  ...defaultTheme,
  primary: { ...defaultTheme.primary, ...finopzPrimary },
};

export { LEVICH_BRAND, levichPrimary };
