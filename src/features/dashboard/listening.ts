import type { PortEntry } from "../../types/ports";

export interface ListeningGroup {
  pid: number | null;
  processName: string | null;
  /** Distinct listening ports, ascending (IPv4 and IPv6 counted once). */
  ports: number[];
}

/** Listening sockets grouped by owning process, ordered by process name then PID. */
export function listeningByProcess(entries: PortEntry[]): ListeningGroup[] {
  const groups = new Map<string, ListeningGroup>();
  for (const e of entries) {
    if (e.state !== "listen") continue;
    const key = String(e.pid);
    const group = groups.get(key) ?? { pid: e.pid, processName: e.processName, ports: [] };
    if (!group.ports.includes(e.localPort)) group.ports.push(e.localPort);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, ports: [...g.ports].sort((a, b) => a - b) }))
    .sort(
      (a, b) =>
        (a.processName ?? "￿").localeCompare(b.processName ?? "￿", undefined, { sensitivity: "base" }) ||
        (a.pid ?? 0) - (b.pid ?? 0),
    );
}
