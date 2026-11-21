/** Mirrors `ProcessDetails` in src-tauri/src/process/mod.rs. */
export interface ProcessDetails {
  pid: number;
  name: string;
  executablePath: string | null;
  pathUnavailableReason: string | null;
}

/** Mirrors `TerminationOutcome` in src-tauri/src/termination/mod.rs. */
export interface TerminationOutcome {
  pid: number;
  name: string;
  exited: boolean;
}
