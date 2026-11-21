/**
 * Mirrors `AppError` in src-tauri/src/error.rs (serde tag = "kind").
 * Errors carry data; `describeError` in src/i18n turns them into text.
 */
export type AppError =
  | { kind: "internal" | "network" | "unsupported" | "storage"; detail: string }
  | { kind: "invalidPid"; pid: number }
  | { kind: "invalidPort"; port: number }
  | { kind: "invalidProcessName" }
  | { kind: "processNameMismatch"; pid: number; expected: string; actual: string }
  | { kind: "processNotFound"; pid: number }
  | { kind: "permissionDenied"; pid: number; name: string | null }
  | { kind: "protectedProcess"; name: string; reason: "criticalSystemProcess" | "portManagerItself" };

export type AppErrorKind = AppError["kind"];
