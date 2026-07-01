import { describe, it, expect } from "vitest";
import { toArgb } from "../../src/core/export-xlsx";

describe("toArgb color mapping (export fidelity)", () => {
  it("maps hex colors (#rgb, #rrggbb, #aarrggbb)", () => {
    expect(toArgb("#4a32c3")).toBe("FF4A32C3");
    expect(toArgb("F9FAFB")).toBe("FFF9FAFB");
    expect(toArgb("#abc")).toBe("FFAABBCC");
    expect(toArgb("80FF0000")).toBe("80FF0000");
  });

  it("maps rgb()/rgba() colors (toolbar-applied fills)", () => {
    expect(toArgb("rgb(74, 50, 195)")).toBe("FF4A32C3");
    expect(toArgb("rgba(255, 0, 0, 1)")).toBe("FFFF0000");
    expect(toArgb("rgba(0, 0, 0, 0.5)")).toBe("80000000");
  });

  it("returns undefined for unknown formats", () => {
    expect(toArgb(undefined)).toBeUndefined();
    expect(toArgb("rebeccapurple")).toBeUndefined();
  });
});
