import { describe, expect, it } from "vitest";
import { commandArgs } from "./commandLine";

describe("commandArgs", () => {
  it("drops a quoted executable path with spaces", () => {
    expect(commandArgs('"C:\\Program Files\\nodejs\\node.exe" node_modules/vite/bin/vite.js --port 5173')).toBe(
      "node_modules/vite/bin/vite.js --port 5173",
    );
  });

  it("drops an unquoted executable", () => {
    expect(commandArgs("node   server.js")).toBe("server.js");
    expect(commandArgs("  hugo.exe server -p 1313 ")).toBe("server -p 1313");
  });

  it("returns nothing when there are no arguments or the input is malformed", () => {
    expect(commandArgs("hugo.exe")).toBe("");
    expect(commandArgs('"C:\\tools\\app.exe"')).toBe("");
    expect(commandArgs('"unterminated quote')).toBe("");
    expect(commandArgs("")).toBe("");
  });
});
