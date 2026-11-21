import { describe, expect, it } from "vitest";
import { makeEntry } from "../../test/fixtures";
import { listeningByProcess } from "./listening";

describe("listeningByProcess", () => {
  it("groups listening ports per process, deduplicating IPv4/IPv6", () => {
    const groups = listeningByProcess([
      makeEntry({ localPort: 5173, pid: 10, processName: "node.exe" }),
      makeEntry({ localPort: 3000, pid: 10, processName: "node.exe" }),
      makeEntry({ localPort: 3000, pid: 10, processName: "node.exe", protocol: "tcp6", localAddress: "::" }),
      makeEntry({ localPort: 1313, pid: 20, processName: "hugo.exe" }),
      makeEntry({ localPort: 445, pid: 4, processName: "System" }),
    ]);
    expect(groups).toEqual([
      { pid: 20, processName: "hugo.exe", ports: [1313] },
      { pid: 10, processName: "node.exe", ports: [3000, 5173] },
      { pid: 4, processName: "System", ports: [445] },
    ]);
  });

  it("ignores non-listening sockets and puts unknown processes last", () => {
    const groups = listeningByProcess([
      makeEntry({ localPort: 50000, state: "established" }),
      makeEntry({ localPort: 80, pid: null, processName: null }),
      makeEntry({ localPort: 8080, pid: 7, processName: "java.exe" }),
    ]);
    expect(groups.map((g) => g.processName)).toEqual(["java.exe", null]);
  });

  it("separates two processes with the same name", () => {
    const groups = listeningByProcess([
      makeEntry({ localPort: 3000, pid: 2, processName: "node.exe" }),
      makeEntry({ localPort: 4000, pid: 1, processName: "node.exe" }),
    ]);
    expect(groups.map((g) => g.pid)).toEqual([1, 2]);
  });
});
