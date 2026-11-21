import { describe, expect, it } from "vitest";
import type { AppError } from "../types/error";
import { describeError } from "./describeError";
import { en } from "./en";
import { ptBR } from "./ptBR";

const ALL_ERRORS: AppError[] = [
  { kind: "internal", detail: "boom" },
  { kind: "network", detail: "x" },
  { kind: "unsupported", detail: "x" },
  { kind: "storage", detail: "disk" },
  { kind: "invalidPid", pid: 0 },
  { kind: "invalidPort", port: 0 },
  { kind: "invalidProcessName" },
  { kind: "processNameMismatch", pid: 8, expected: "node.exe", actual: "hugo.exe" },
  { kind: "processNotFound", pid: 9 },
  { kind: "permissionDenied", pid: 4, name: null },
  { kind: "permissionDenied", pid: 4, name: "svc.exe" },
  { kind: "protectedProcess", name: "csrss.exe", reason: "criticalSystemProcess" },
  { kind: "protectedProcess", name: "Port Manager", reason: "portManagerItself" },
];

describe("describeError", () => {
  it.each(ALL_ERRORS)("produces distinct, complete text in both languages for %o", (error) => {
    const english = describeError(en, error);
    const portuguese = describeError(ptBR, error);
    for (const text of [english, portuguese]) {
      expect(text).toBeTruthy();
      expect(text).not.toContain("undefined");
    }
    expect(portuguese).not.toBe(english);
  });

  it("keeps the variable parts in the sentence", () => {
    expect(describeError(ptBR, ALL_ERRORS[7])).toMatch(/hugo\.exe.*node\.exe/);
    expect(describeError(ptBR, ALL_ERRORS[10])).toContain("svc.exe (PID 4)");
  });
});

describe("dictionaries", () => {
  type Tree = { [key: string]: unknown };

  function compareShape(a: Tree, b: Tree, path: string): string[] {
    return Object.keys(a).flatMap((key) => {
      const here = path + key;
      if (!(key in b)) return [`missing ${here}`];
      if (typeof a[key] !== typeof b[key]) return [`type differs at ${here}`];
      if (typeof a[key] === "object") return compareShape(a[key] as Tree, b[key] as Tree, `${here}.`);
      if (typeof b[key] === "string" && !(b[key] as string).trim()) return [`empty ${here}`];
      return [];
    });
  }

  it("pt-BR has the same keys and kinds of values as English", () => {
    expect(compareShape(en, ptBR, "")).toEqual([]);
    expect(compareShape(ptBR, en, "")).toEqual([]);
  });
});
