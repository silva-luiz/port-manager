import type { PortEntry, TcpState } from "../../types/ports";

export interface PortFilters {
  search: string;
  /** Exact process name, or "" for all. */
  processName: string;
  /** Raw text from the port input; applied only when it is a valid port. */
  port: string;
  state: TcpState | "";
}

export const EMPTY_FILTERS: PortFilters = { search: "", processName: "", port: "", state: "" };

export function hasActiveFilters(filters: PortFilters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof PortFilters)[]).some((k) => filters[k] !== EMPTY_FILTERS[k]);
}

export type SortKey = "localPort" | "protocol" | "localAddress" | "processName" | "pid" | "state";

export interface SortOrder {
  key: SortKey;
  direction: "asc" | "desc";
}

/** Identity of a socket across refreshes (used to keep a row selected). */
export function entryKey(e: PortEntry): string {
  return [e.protocol, e.localAddress, e.localPort, e.remoteAddress, e.remotePort, e.pid].join("|");
}

/** Parses a TCP port number, returning null for anything outside 0–65535. */
export function parsePort(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return null;
  const port = Number(trimmed);
  return port <= 65535 ? port : null;
}

export function filterPorts(entries: PortEntry[], filters: PortFilters): PortEntry[] {
  const search = filters.search.trim().toLowerCase();
  const port = parsePort(filters.port);

  return entries.filter((e) => {
    if (filters.processName && e.processName !== filters.processName) return false;
    if (filters.state && e.state !== filters.state) return false;
    if (port !== null && e.localPort !== port) return false;
    if (!search) return true;
    return [e.localPort, e.localAddress, e.remoteAddress, e.remotePort, e.processName, e.pid].some(
      (v) => v !== null && String(v).toLowerCase().includes(search),
    );
  });
}

/** Sorts a copy; missing values always go last regardless of direction. */
export function sortPorts(entries: PortEntry[], { key, direction }: SortOrder): PortEntry[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return a.localPort - b.localPort;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true });
    return cmp * factor;
  });
}

export function distinctProcessNames(entries: PortEntry[]): string[] {
  const names = new Set<string>();
  for (const e of entries) if (e.processName) names.add(e.processName);
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function distinctStates(entries: PortEntry[]): TcpState[] {
  return [...new Set(entries.map((e) => e.state))].sort();
}
