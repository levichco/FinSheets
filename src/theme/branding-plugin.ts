/**
 * Levich branding entry point. Tags the host container with a class so the
 * Levich CSS overrides apply, and re-exports the brand theme/constants. The
 * toolbar style is handled by the ribbon type ("simple"); the brand color is
 * carried by the theme + CSS variables (levich-theme.css).
 */
import { LEVICH_BRAND, levichPrimary } from "./brand";
import { levichTheme } from "./levich-theme";

/** Class added to the Univer container to scope Levich CSS overrides. */
export const LEVICH_CONTAINER_CLASS = "univer-levich";

/** Tag the container so the Levich CSS variable overrides take effect. */
export function brandContainer(container: HTMLElement): void {
  container.classList.add(LEVICH_CONTAINER_CLASS);
}

export { LEVICH_BRAND, levichPrimary, levichTheme };
