import type { Favorite } from "../../types/favorites";
import type { PortEntry, TcpState } from "../../types/ports";

export interface PortOwner {
  pid: number | null;
  processName: string | null;
  states: TcpState[];
}

export interface FavoriteUsage {
  port: number;
  /** True when at least one socket on the port is live (not TIME_WAIT/CLOSED). */
  inUse: boolean;
  owners: PortOwner[];
}

const DEAD_STATES: TcpState[] = ["timeWait", "closed"];

/** Joins favorites with the current snapshot, grouping sockets by owning process. */
export function favoriteUsage(favorites: Favorite[], entries: PortEntry[]): FavoriteUsage[] {
  return favorites.map(({ port }) => {
    const sockets = entries.filter((e) => e.localPort === port);
    const owners = new Map<string, PortOwner>();
    for (const s of sockets) {
      const key = String(s.pid);
      const owner = owners.get(key) ?? { pid: s.pid, processName: s.processName, states: [] };
      if (!owner.states.includes(s.state)) owner.states.push(s.state);
      owners.set(key, owner);
    }
    return {
      port,
      inUse: sockets.some((s) => !DEAD_STATES.includes(s.state)),
      owners: [...owners.values()],
    };
  });
}
