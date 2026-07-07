/**
 * Google Fonts library — load any font on demand so sheets render with the
 * correct typeface (Univer draws on a canvas, so a font must be in the browser's
 * FontFaceSet before it paints, or text falls back to serif).
 *
 * - `ensureGoogleFont(name)` / `ensureGoogleFonts(names)` inject a Google Fonts
 *   CSS2 <link> and await the actual font load (deduped, cached, timeout-guarded).
 * - `fontsInSnapshot(snapshot)` collects every `ff` used in a workbook snapshot,
 *   so an imported .xlsx pulls exactly the fonts it needs.
 *
 * Office fonts (Calibri, Cambria, …) aren't on Google Fonts — they're handled by
 * the metric-compatible substitutes in office-fonts.css, so we skip them here.
 */

// A broad, popular Google Fonts set for the toolbar dropdown. Any OTHER family
// (e.g. from an import) still loads on demand — this is just the offered list.
export const GOOGLE_FONTS: string[] = [
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Inter", "Raleway", "Nunito",
  "Nunito Sans", "Work Sans", "Source Sans 3", "Noto Sans", "Rubik", "Mulish", "DM Sans",
  "Manrope", "Karla", "PT Sans", "Ubuntu", "Fira Sans", "Cabin", "Barlow", "Titillium Web",
  "Oswald", "Roboto Condensed", "Roboto Slab", "Roboto Mono", "Space Grotesk", "IBM Plex Sans",
  "IBM Plex Mono", "Inconsolata", "Merriweather", "Playfair Display", "Lora", "PT Serif",
  "Libre Baskerville", "EB Garamond", "Crimson Text", "Bitter", "Arvo", "Zilla Slab",
  "Josefin Sans", "Quicksand", "Comfortaa", "Archivo", "Bebas Neue", "Anton", "Dancing Script",
  "Pacifico", "Caveat",
];

// System / Office fonts we never request from Google (substitutes or built-in).
const SKIP = new Set(
  ["Arial", "Helvetica", "Calibri", "Cambria", "Times New Roman", "Courier New", "Georgia",
    "Verdana", "Tahoma", "Trebuchet MS", "Segoe UI", "system-ui", "sans-serif", "serif", "monospace", "Work Sans"]
    .map((f) => f.toLowerCase()),
);

const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** Inject one Google Fonts CSS2 stylesheet covering the given families (batched). */
function injectLink(families: string[]) {
  if (typeof document === "undefined" || !families.length) return;
  const id = "gf-" + families.map((f) => f.replace(/[^a-z0-9]+/gi, "").toLowerCase()).join("_").slice(0, 80);
  if (document.getElementById(id)) return;
  const spec = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,400;0,700;1,400;1,700`)
    .join("&");
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${spec}&display=swap`;
  document.head.appendChild(link);
}

/** Await a font actually becoming usable (regular + bold), with a timeout so it never hangs. */
async function awaitFont(family: string) {
  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;
  try {
    await Promise.race([
      Promise.all([fonts.load(`16px "${family}"`), fonts.load(`700 16px "${family}"`)]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* best-effort */ }
}

/** Load a single Google font (deduped). No-op for system/Office fonts. */
export function ensureGoogleFont(family: string): Promise<void> {
  const f = (family || "").trim().replace(/^['"]|['"]$/g, "");
  if (!f || SKIP.has(f.toLowerCase()) || loaded.has(f)) return Promise.resolve();
  const existing = pending.get(f);
  if (existing) return existing;
  const p = (async () => { injectLink([f]); await awaitFont(f); loaded.add(f); })();
  pending.set(f, p);
  return p;
}

/** Load many fonts in ONE batched request, then await each. */
export function ensureGoogleFonts(families: string[]): Promise<void> {
  const want = Array.from(new Set(families.map((f) => (f || "").trim().replace(/^['"]|['"]$/g, ""))))
    .filter((f) => f && !SKIP.has(f.toLowerCase()) && !loaded.has(f));
  if (!want.length) return Promise.resolve();
  injectLink(want);
  return Promise.all(want.map(async (f) => {
    if (!pending.has(f)) pending.set(f, awaitFont(f).then(() => { loaded.add(f); }));
    return pending.get(f);
  })).then(() => undefined);
}

/** Every distinct font family referenced by a workbook snapshot's styles. */
export function fontsInSnapshot(snapshot: unknown): string[] {
  const set = new Set<string>();
  const styles = (snapshot as { styles?: Record<string, { ff?: string }> } | null)?.styles ?? {};
  for (const id in styles) { const ff = styles[id]?.ff; if (typeof ff === "string" && ff.trim()) set.add(ff.trim()); }
  return [...set];
}

/** Load all fonts an imported/rendered snapshot needs (batched). */
export function ensureFontsForSnapshot(snapshot: unknown): Promise<void> {
  return ensureGoogleFonts(fontsInSnapshot(snapshot));
}
