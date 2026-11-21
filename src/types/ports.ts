import type { AppError } from "./error";

/** Mirrors `Protocol` in src-tauri/src/network/mod.rs. */
export type Protocol = "tcp" | "tcp6" | "udp" | "udp6";

/** Mirrors `SocketState` in src-tauri/src/network/mod.rs. */
export type SocketState =
  | "closed"
  | "listen"
  | "synSent"
  | "synReceived"
  | "established"
  | "finWait1"
  | "finWait2"
  | "closeWait"
  | "closing"
  | "lastAck"
  | "timeWait"
  | "deleteTcb"
  /** UDP has no connection state; a bound UDP socket is in use. */
  | "bound"
  | "unknown";

/** Mirrors `PortEntry` in src-tauri/src/ports.rs. */
export interface PortEntry {
  protocol: Protocol;
  localAddress: string;
  localPort: number;
  remoteAddress: string | null;
  remotePort: number | null;
  state: SocketState;
  /** Socket still counts as in use (computed by the backend; never re-derive it). */
  live: boolean;
  pid: number | null;
  processName: string | null;
  /** Full command line; null when Windows won't reveal it. */
  commandLine: string | null;
}

/** Mirrors `PortSummary` in src-tauri/src/ports.rs. */
export interface PortSummary {
  activePorts: number;
  uniqueProcesses: number;
  listeningPorts: number;
  establishedConnections: number;
}

/** Mirrors `PortSnapshot` in src-tauri/src/ports.rs. */
export interface PortSnapshot {
  entries: PortEntry[];
  summary: PortSummary;
  scannedAtMs: number;
  processLookupError: AppError | null;
}
