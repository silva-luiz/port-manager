/** Mirrors `AppError` in src-tauri/src/error.rs (serde tag = "kind"). */
export type AppErrorKind =
  | "internal"
  | "network"
  | "unsupported"
  | "invalidInput"
  | "processNotFound"
  | "permissionDenied"
  | "protectedProcess"
  | "storage";

export interface AppError {
  kind: AppErrorKind;
  message: string;
}
