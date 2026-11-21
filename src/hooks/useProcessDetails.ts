import { useEffect, useState } from "react";
import { api, toAppError } from "../lib/api";
import type { AppError } from "../types/error";
import type { ProcessDetails } from "../types/process";

export type ProcessDetailsState =
  | { phase: "none" }
  | { phase: "loading" }
  | { phase: "loaded"; details: ProcessDetails }
  | { phase: "error"; error: AppError };

/** Loads details for `pid`; ignores responses for a PID that is no longer selected. */
export function useProcessDetails(pid: number | null): ProcessDetailsState {
  const [state, setState] = useState<ProcessDetailsState>({ phase: "none" });

  useEffect(() => {
    if (pid === null) {
      setState({ phase: "none" });
      return;
    }
    let current = true;
    setState({ phase: "loading" });
    api
      .processDetails(pid)
      .then((details) => current && setState({ phase: "loaded", details }))
      .catch((e) => current && setState({ phase: "error", error: toAppError(e) }));
    return () => {
      current = false;
    };
  }, [pid]);

  return state;
}
