import { useCallback, useEffect, useRef, useState } from "react";
import { api, toAppError } from "../lib/api";
import type { AppError } from "../types/error";
import type { PortSnapshot } from "../types/ports";

interface RefreshOptions {
  /** Background refreshes don't show the busy state on refresh buttons. */
  background?: boolean;
}

/**
 * Loads the port snapshot on mount, on demand and, when `autoRefreshSeconds`
 * is positive, periodically while the window is visible. The previous
 * snapshot stays visible while a refresh is in flight or after it fails.
 */
export function usePortSnapshot(autoRefreshSeconds = 0) {
  const [snapshot, setSnapshot] = useState<PortSnapshot | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
  // Overlapping refreshes can resolve out of order; only the newest may win.
  const latestRequest = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async ({ background = false }: RefreshOptions = {}) => {
    const request = ++latestRequest.current;
    inFlight.current = true;
    if (!background) setLoading(true);
    try {
      const next = await api.listPorts();
      if (request !== latestRequest.current) return;
      setSnapshot(next);
      setError(null);
    } catch (e) {
      if (request !== latestRequest.current) return;
      setError(toAppError(e));
    } finally {
      if (request === latestRequest.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRefreshSeconds <= 0) return;
    const tick = () => {
      if (document.visibilityState === "visible" && !inFlight.current) void refresh({ background: true });
    };
    const timer = window.setInterval(tick, autoRefreshSeconds * 1000);
    // Catch up immediately when the window comes back instead of waiting a full interval.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [autoRefreshSeconds, refresh]);

  return { snapshot, error, loading, refresh };
}

export type PortSnapshotState = ReturnType<typeof usePortSnapshot>;
