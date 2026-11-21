import type { HealthState } from "../../hooks/useHealthCheck";
import { useI18n } from "../../i18n/I18nProvider";

const DOT: Record<HealthState["phase"], string> = {
  checking: "bg-warn animate-pulse",
  online: "bg-ok",
  offline: "bg-danger",
};

export function BackendStatusBadge({ state }: { state: HealthState }) {
  const { t } = useI18n();
  return (
    <span role="status" className="flex items-center gap-2 text-xs text-muted">
      <span className={`size-2 rounded-full ${DOT[state.phase]}`} aria-hidden />
      {t.backend[state.phase]}
    </span>
  );
}
