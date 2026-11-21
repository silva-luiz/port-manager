import { useCallback, useEffect, useState } from "react";
import { api, toAppError } from "../lib/api";
import type { AppError } from "../types/error";
import type { PortSnapshot } from "../types/ports";

/**
 * Loads the port snapshot once on mount and on demand. The previous snapshot
 * stays visible while a refresh is in flight or after a failed refresh.
 */
export function usePortSnapshot() {
  const [snapshot, setSnapshot] = useState<PortSnapshot | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await api.listPorts());
      setError(null);
    } catch (e) {
      setError(toAppError(e));
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
