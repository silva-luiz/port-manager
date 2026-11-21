import type { Favorite } from "../../types/favorites";
import type { PortEntry, SocketState } from "../../types/ports";

export interface PortOwner {
  pid: number | null;
  processName: string | null;
  states: SocketState[];
}

export interface FavoriteUsage {
  port: number;
  /** True when at least one socket on the port is live (as decided by the backend). */
  inUse: boolean;
  owners: PortOwner[];
}

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
      inUse: sockets.some((s) => s.live),
      owners: [...owners.values()],
    };
  });
}
