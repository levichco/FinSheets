/**
 * <ColorPanel> — the full Google-Sheets colour picker (10×8 palette + Standard
 * row + in-panel Custom saturation/hue/hex picker). Shared by the toolbar's
 * text/fill/border colour dropdowns and the sheet-tab "Change colour" menu so
 * every colour surface looks identical.
 *
 * `onPick` = a swatch was clicked (apply + the caller usually closes the menu).
 * `onApply` = a live value from the Custom picker (apply, keep the panel open).
 */
import { useRef, useState, type CSSProperties } from "react";

// preventDefault on mousedown keeps the cell editor / trigger focused while picking.
const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

// Google Sheets / Docs palette (10 cols × 8 rows) + a compact Standard row.
export const GOOGLE_PALETTE: string[] = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd",
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0",
  "#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79",
  "#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47",
  "#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130",
];
export const STANDARD_COLORS = ["#000000", "#ffffff", "#4a86e8", "#e06666", "#ffd966", "#93c47d", "#f6b26b", "#76a5af"];

const sectionLabelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: "#98a2b3", margin: "10px 2px 6px" };

function Swatch({ c, selected, onPick }: { c: string; selected?: boolean; onPick: (c: string) => void }) {
  const isWhite = c.toLowerCase() === "#ffffff";
  return (
    <button
      type="button" aria-label={c} aria-pressed={selected} title={c}
      onMouseDown={keepFocus} onClick={() => onPick(c)}
      style={{ width: 16, height: 16, borderRadius: 3, border: selected ? "2px solid #101828" : isWhite ? "1px solid #d0d5dd" : "1px solid rgba(0,0,0,0.12)", background: c, cursor: "pointer", padding: 0, transition: "transform .1s ease, box-shadow .1s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.25)"; e.currentTarget.style.boxShadow = "0 0 0 2px #fde68a"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

/* ---- Colour maths (for the in-panel custom picker) ------------------------ */
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [16, 24, 40];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** In-panel custom colour picker (saturation/value square + hue slider + hex). */
function CustomColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const initial = rgbToHsv(...hexToRgb(value));
  const [hsv, setHsv] = useState<[number, number, number]>(initial);
  const [hex, setHex] = useState(value);
  const boxRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const commit = (h: number, s: number, v: number) => { const hx = rgbToHex(...hsvToRgb(h, s, v)); setHex(hx); onChange(hx); };
  const drag = (ref: typeof boxRef, e: PointerEvent | { clientX: number; clientY: number }, hue: boolean) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const [h] = hsvRef.current;
    if (hue) {
      const nh = clamp01((e.clientX - r.left) / r.width) * 360;
      const next: [number, number, number] = [nh, hsvRef.current[1], hsvRef.current[2]];
      setHsv(next); commit(...next);
    } else {
      const s = clamp01((e.clientX - r.left) / r.width);
      const v = 1 - clamp01((e.clientY - r.top) / r.height);
      const next: [number, number, number] = [h, s, v];
      setHsv(next); commit(...next);
    }
  };
  const start = (ref: typeof boxRef, hue: boolean) => (e: { clientX: number; clientY: number; preventDefault: () => void }) => {
    e.preventDefault();
    drag(ref, e, hue);
    const mv = (ev: PointerEvent) => drag(ref, ev, hue);
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };

  const [h, s, v] = hsv;
  const hueColor = rgbToHex(...hsvToRgb(h, 1, 1));
  return (
    <div style={{ marginTop: 6 }} onMouseDown={keepFocus}>
      <div ref={boxRef} onPointerDown={start(boxRef, false)}
        style={{ position: "relative", height: 116, borderRadius: 8, cursor: "crosshair", background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)), ${hueColor}` }}>
        <span style={{ position: "absolute", left: `${s * 100}%`, top: `${(1 - v) * 100}%`, width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.4)", background: hex, pointerEvents: "none" }} />
      </div>
      <div ref={hueRef} onPointerDown={start(hueRef, true)}
        style={{ position: "relative", height: 12, borderRadius: 6, marginTop: 10, cursor: "ew-resize", background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
        <span style={{ position: "absolute", left: `${(h / 360) * 100}%`, top: "50%", width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.4)", background: hueColor, pointerEvents: "none" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #d0d5dd", background: hex, flexShrink: 0 }} />
        <input value={hex} onMouseDown={keepFocus}
          onChange={(e) => { const t = e.target.value; setHex(t); if (/^#?[0-9a-f]{6}$/i.test(t)) { const norm = t.startsWith("#") ? t : "#" + t; setHsv(rgbToHsv(...hexToRgb(norm))); onChange(norm); } }}
          style={{ flex: 1, height: 30, borderRadius: 8, border: "1px solid #d0d5dd", padding: "0 10px", fontSize: 13, color: "#101828", textTransform: "uppercase", fontVariantNumeric: "tabular-nums", outline: "none" }} />
      </div>
    </div>
  );
}

export function ColorPanel({ current, onPick, onApply }: { current?: string; onPick: (c: string) => void; onApply: (c: string) => void }) {
  const [showCustom, setShowCustom] = useState(false);
  const isSel = (c: string) => !!current && current.toLowerCase() === c.toLowerCase();
  return (
    <div style={{ width: 196 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
        {GOOGLE_PALETTE.map((c, i) => <Swatch key={i} c={c} selected={isSel(c)} onPick={onPick} />)}
      </div>
      <div style={sectionLabelStyle}>STANDARD</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
        {STANDARD_COLORS.map((c, i) => <Swatch key={i} c={c} selected={isSel(c)} onPick={onPick} />)}
      </div>
      <div style={sectionLabelStyle}>CUSTOM</div>
      <button type="button" onMouseDown={keepFocus} onClick={() => setShowCustom((x) => !x)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#475467", padding: "2px 2px" }}>
        <span style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid #d0d5dd", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, lineHeight: 1, color: "#667085" }}>{showCustom ? "–" : "+"}</span>
        Custom…
      </button>
      {showCustom && <CustomColorPicker value={current && /^#/.test(current) ? current : "#101828"} onChange={onApply} />}
    </div>
  );
}

export default ColorPanel;
