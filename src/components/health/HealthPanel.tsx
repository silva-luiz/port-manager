import type { HealthState } from "../../hooks/useHealthCheck";
import { useI18n } from "../../i18n/I18nProvider";
import { RefreshButton } from "../RefreshButton";

interface HealthPanelProps {
  state: HealthState;
  onCheck: () => void;
}

export function HealthPanel({ state, onCheck }: HealthPanelProps) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="health-title" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 id="health-title" className="font-medium">
          {t.health.title}
        </h2>
        <RefreshButton onClick={onCheck} busy={state.phase === "checking"} label={t.health.checkAgain} />
      </div>
      <div className="px-4 py-3">
        <HealthBody state={state} />
      </div>
    </section>
  );
}

function HealthBody({ state }: { state: HealthState }) {
  const { t, formatTime, describeError } = useI18n();

  if (state.phase === "checking") {
    return <p className="text-muted">{t.health.checking}</p>;
  }

  if (state.phase === "offline") {
    return (
      <p className="text-danger">
        {t.health.offline} {describeError(state.error)} {t.health.browserHint}{" "}
        <code className="font-mono">npm run tauri dev</code>.
      </p>
    );
  }

  const { health, latencyMs } = state;
  const rows: [string, string][] = [
    [t.health.status, health.status],
    [t.health.appVersion, health.appVersion],
    [t.health.platform, `${health.os} (${health.arch})`],
    [t.health.roundTrip, `${latencyMs.toFixed(1)} ms`],
    [t.health.checkedAt, formatTime(health.timestampMs)],
  ];

  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="font-mono text-[12px]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
