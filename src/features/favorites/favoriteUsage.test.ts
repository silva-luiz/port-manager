import { describe, expect, it } from "vitest";
import { makeEntry } from "../../test/fixtures";
import { favoriteUsage } from "./favoriteUsage";

const fav = (port: number) => ({ port, createdAtMs: 0 });

describe("favoriteUsage", () => {
  const entries = [
    makeEntry({ localPort: 1313, processName: "hugo.exe", pid: 35188, state: "listen" }),
    makeEntry({ localPort: 1313, processName: "hugo.exe", pid: 35188, state: "established" }),
    makeEntry({ localPort: 3000, processName: null, pid: null, state: "timeWait", live: false }),
  ];
  const [hugo, leftover, free] = favoriteUsage([fav(1313), fav(3000), fav(8080)], entries);

  it("groups sockets by owning process and merges their states", () => {
    expect(hugo.inUse).toBe(true);
    expect(hugo.owners).toEqual([{ pid: 35188, processName: "hugo.exe", states: ["listen", "established"] }]);
  });

  it("uses the backend's live flag: leftover sockets don't make a port in use", () => {
    expect(leftover.inUse).toBe(false);
    expect(leftover.owners).toHaveLength(1);
  });

  it("reports ports without sockets as free", () => {
    expect(free).toEqual({ port: 8080, inUse: false, owners: [] });
  });
});
