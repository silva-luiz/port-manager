import { describe, expect, it } from "vitest";
import { shortcutFor } from "./shortcuts";

const key = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("shortcutFor", () => {
  it("maps the supported shortcuts", () => {
    expect(shortcutFor(key("f", { ctrlKey: true }))).toBe("search");
    expect(shortcutFor(key("F", { ctrlKey: true }))).toBe("search");
    expect(shortcutFor(key("F5"))).toBe("refresh");
    expect(shortcutFor(key("r", { ctrlKey: true }))).toBe("refresh");
    expect(shortcutFor(key("R", { ctrlKey: true, shiftKey: true }))).toBe("refresh");
    expect(shortcutFor(key("Escape"))).toBe("close");
  });

  it("ignores everything else", () => {
    expect(shortcutFor(key("f"))).toBeNull();
    expect(shortcutFor(key("f", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(shortcutFor(key("F", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(shortcutFor(key("r"))).toBeNull();
    expect(shortcutFor(key("Escape", { ctrlKey: true }))).toBeNull();
  });
});
