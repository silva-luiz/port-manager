import { useCallback, useEffect, useRef, useState } from "react";
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
  // Overlapping refreshes can resolve out of order; only the newest may win.
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    try {
      const next = await api.listPorts();
      if (request !== latestRequest.current) return;
      setSnapshot(next);
      setError(null);
    } catch (e) {
      if (request !== latestRequest.current) return;
      setError(toAppError(e));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, error, loading, refresh };
}

export type PortSnapshotState = ReturnType<typeof usePortSnapshot>;
