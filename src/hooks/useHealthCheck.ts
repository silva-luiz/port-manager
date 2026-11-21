import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import type { HealthStatus } from "../types/health";

export type HealthState =
  | { phase: "checking" }
  | { phase: "online"; health: HealthStatus; latencyMs: number }
  | { phase: "offline"; error: string };

export function useHealthCheck() {
  const [state, setState] = useState<HealthState>({ phase: "checking" });

  const check = useCallback(async () => {
    setState({ phase: "checking" });
    const started = performance.now();
    try {
      const health = await api.healthCheck();
      setState({ phase: "online", health, latencyMs: performance.now() - started });
    } catch (error) {
      setState({ phase: "offline", error: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { state, check };
}
