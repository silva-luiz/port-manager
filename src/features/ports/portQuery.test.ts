import { describe, expect, it } from "vitest";
import { makeEntry } from "../../test/fixtures";
import {
  DEFAULT_FILTERS,
  distinctProcessNames,
  distinctStates,
  entryKey,
  filterPorts,
  hasActiveFilters,
  parsePort,
  sortPorts,
} from "./portQuery";

const rows = [
  makeEntry({ localPort: 5000, processName: "node.exe", pid: 10, commandLine: "node node_modules/vite/bin/vite.js" }),
  makeEntry({ localPort: 1313, processName: "hugo.exe", pid: 35188 }),
  makeEntry({ localPort: 80, processName: null, pid: null, state: "timeWait", live: false }),
  makeEntry({ localPort: 443, processName: "System", pid: 4, state: "established", remoteAddress: "10.0.0.9", remotePort: 51000 }),
];

const ports = (entries: { localPort: number }[]) => entries.map((e) => e.localPort);

/** Filters that show everything, so each test isolates one criterion. */
const ALL = { ...DEFAULT_FILTERS, hideInactive: false };

describe("parsePort", () => {
  it("accepts 0–65535 with surrounding spaces", () => {
    expect(parsePort("1313")).toBe(1313);
    expect(parsePort(" 80 ")).toBe(80);
    expect(parsePort("0")).toBe(0);
    expect(parsePort("65535")).toBe(65535);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "70000", "12a", "-1", "1.5", "123456"]) expect(parsePort(bad)).toBeNull();
  });
});

describe("filterPorts", () => {
  it("searches process names, PIDs, ports and addresses", () => {
    expect(ports(filterPorts(rows, { ...ALL, search: "HUGO" }))).toEqual([1313]);
    expect(ports(filterPorts(rows, { ...ALL, search: "35188" }))).toEqual([1313]);
    expect(ports(filterPorts(rows, { ...ALL, search: "10.0.0.9" }))).toEqual([443]);
    expect(ports(filterPorts(rows, { ...ALL, search: "vite" }))).toEqual([5000]);
  });

  it("filters by exact local port and ignores an invalid port", () => {
    expect(ports(filterPorts(rows, { ...ALL, port: "80" }))).toEqual([80]);
    expect(filterPorts(rows, { ...ALL, port: "abc" })).toHaveLength(rows.length);
  });

  it("hides inactive sockets by default", () => {
    expect(ports(filterPorts(rows, DEFAULT_FILTERS))).toEqual([5000, 1313, 443]);
    expect(filterPorts(rows, ALL)).toHaveLength(rows.length);
  });

  it("lets an explicit state choice override hiding inactive sockets", () => {
    expect(ports(filterPorts(rows, { ...DEFAULT_FILTERS, state: "timeWait" }))).toEqual([80]);
  });

  it("filters by protocol family, including IPv6", () => {
    const mixed = [
      makeEntry({ localPort: 1, protocol: "tcp" }),
      makeEntry({ localPort: 2, protocol: "tcp6" }),
      makeEntry({ localPort: 3, protocol: "udp", state: "bound" }),
      makeEntry({ localPort: 4, protocol: "udp6", state: "bound" }),
    ];
    expect(ports(filterPorts(mixed, { ...ALL, protocol: "tcp" }))).toEqual([1, 2]);
    expect(ports(filterPorts(mixed, { ...ALL, protocol: "udp" }))).toEqual([3, 4]);
    expect(filterPorts(mixed, ALL)).toHaveLength(4);
  });

  it("filters by process and state together", () => {
    expect(ports(filterPorts(rows, { ...ALL, state: "established" }))).toEqual([443]);
    expect(filterPorts(rows, { ...ALL, processName: "hugo.exe", state: "established" })).toEqual([]);
  });
});

describe("sortPorts", () => {
  it("sorts numbers numerically in both directions", () => {
    expect(ports(sortPorts(rows, { key: "localPort", direction: "asc" }))).toEqual([80, 443, 1313, 5000]);
    expect(ports(sortPorts(rows, { key: "localPort", direction: "desc" }))).toEqual([5000, 1313, 443, 80]);
  });

  it("keeps missing values last regardless of direction", () => {
    expect(sortPorts(rows, { key: "processName", direction: "asc" }).map((r) => r.processName)).toEqual([
      "hugo.exe",
      "node.exe",
      "System",
      null,
    ]);
    expect(sortPorts(rows, { key: "pid", direction: "desc" }).map((r) => r.pid)).toEqual([35188, 10, 4, null]);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    sortPorts(rows, { key: "pid", direction: "asc" });
    expect(rows).toEqual(copy);
  });
});

describe("helpers", () => {
  it("lists distinct process names and states", () => {
    expect(distinctProcessNames(rows)).toEqual(["hugo.exe", "node.exe", "System"]);
    expect(distinctStates(rows)).toEqual(["established", "listen", "timeWait"]);
  });

  it("detects active filters", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(ALL)).toBe(true);
    expect(hasActiveFilters({ ...ALL, port: "80" })).toBe(true);
  });

  it("gives a socket the same key across refreshes", () => {
    expect(entryKey(makeEntry())).toBe(entryKey(makeEntry()));
    expect(entryKey(makeEntry({ pid: 1 }))).not.toBe(entryKey(makeEntry({ pid: 2 })));
  });
});
