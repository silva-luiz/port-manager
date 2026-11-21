import { describe, expect, it } from "vitest";
import { toAppError } from "./api";

describe("toAppError", () => {
  it("passes structured backend errors through unchanged", () => {
    const error = { kind: "processNotFound", pid: 3 };
    expect(toAppError(error)).toBe(error);
  });

  it("wraps plain strings (e.g. Tauri argument errors) as internal errors", () => {
    expect(toAppError("invalid args `pid`")).toEqual({ kind: "internal", detail: "invalid args `pid`" });
  });

  it("wraps Error instances and unknown shapes", () => {
    expect(toAppError(new Error("boom"))).toEqual({ kind: "internal", detail: "boom" });
    expect(toAppError({ kind: "bogus" })).toEqual({ kind: "internal", detail: "unknown error" });
    expect(toAppError(undefined)).toEqual({ kind: "internal", detail: "unknown error" });
  });
});
