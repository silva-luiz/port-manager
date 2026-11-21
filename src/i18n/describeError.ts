import type { AppError } from "../types/error";
import type { Messages } from "./en";

/** Turns a structured backend error into a sentence in the current language. */
export function describeError(t: Messages, error: AppError): string {
  const e = t.errors;
  switch (error.kind) {
    case "internal":
      return e.internal(error.detail);
    case "network":
      return e.network(error.detail);
    case "unsupported":
      return e.unsupported(error.detail);
    case "storage":
      return e.storage(error.detail);
    case "invalidPid":
      return e.invalidPid(error.pid);
    case "invalidPort":
      return e.invalidPort(error.port);
    case "invalidProcessName":
      return e.invalidProcessName;
    case "processNameMismatch":
      return e.processNameMismatch(error.pid, error.expected, error.actual);
    case "processNotFound":
      return e.processNotFound(error.pid);
    case "permissionDenied":
      return error.name ? e.permissionDeniedNamed(error.name, error.pid) : e.permissionDenied(error.pid);
    case "protectedProcess":
      return error.reason === "portManagerItself" ? e.protectedSelf : e.protectedCritical(error.name);
  }
}
