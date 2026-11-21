import type { HealthState } from "../../hooks/useHealthCheck";

const LABELS: Record<HealthState["phase"], string> = {
  checking: "Connecting to backend",
  online: "Backend connected",
  offline: "Backend unreachable",
};

const DOT: Record<HealthState["phase"], string> = {
  checking: "bg-warn animate-pulse",
  online: "bg-ok",
  offline: "bg-danger",
};

export function BackendStatusBadge({ state }: { state: HealthState }) {
  return (
    <span role="status" className="flex items-center gap-2 text-xs text-muted">
      <span className={`size-2 rounded-full ${DOT[state.phase]}`} aria-hidden />
      {LABELS[state.phase]}
    </span>
  );
}
