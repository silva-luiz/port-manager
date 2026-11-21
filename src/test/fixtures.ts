import type { PortEntry } from "../types/ports";

/** Builds a socket row with sensible defaults; override only what a test cares about. */
export function makeEntry(overrides: Partial<PortEntry> = {}): PortEntry {
  return {
    protocol: "tcp",
    localAddress: "127.0.0.1",
    localPort: 3000,
    remoteAddress: null,
    remotePort: null,
    state: "listen",
    live: true,
    pid: 1000,
    processName: "node.exe",
    commandLine: null,
    ...overrides,
  };
}
