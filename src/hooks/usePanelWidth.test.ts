import { describe, expect, it } from "vitest";
import { clampPanelWidth, DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, maxPanelWidth } from "./usePanelWidth";

describe("clampPanelWidth", () => {
  it("keeps widths inside the allowed range", () => {
    expect(clampPanelWidth(500, 1200)).toBe(500);
    expect(clampPanelWidth(100, 1200)).toBe(MIN_PANEL_WIDTH);
    expect(clampPanelWidth(5000, 1200)).toBe(maxPanelWidth(1200));
  });

  it("never goes below the minimum, even in a tiny window", () => {
    expect(clampPanelWidth(400, 300)).toBe(MIN_PANEL_WIDTH);
  });

  it("falls back to the default for garbage stored values", () => {
    expect(clampPanelWidth(Number("abc"), 1200)).toBe(DEFAULT_PANEL_WIDTH);
  });
});
