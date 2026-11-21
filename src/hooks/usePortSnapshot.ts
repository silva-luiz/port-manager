import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import type { PortSnapshot } from "../types/ports";

/**
 * Loads the port snapshot once on mount and on demand. The previous snapshot
 * stays visible while a refresh is in flight or after a failed refresh.
 */
export function usePortSnapshot() {
  const [snapshot, setSnapshot] = useState<PortSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await api.listPorts());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, error, loading, refresh };
}

export type PortSnapshotState = ReturnType<typeof usePortSnapshot>;
