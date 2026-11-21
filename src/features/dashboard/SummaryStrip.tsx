import { useI18n } from "../../i18n/I18nProvider";
import type { PortSnapshot } from "../../types/ports";

export function SummaryStrip({ snapshot }: { snapshot: PortSnapshot | null }) {
  const { t, formatNumber, formatTime } = useI18n();
  const s = snapshot?.summary;
  const n = (v: number | undefined) => (v === undefined ? "–" : formatNumber(v));
  const labels = t.dashboard.stats;

  const stats = [
    { label: labels.activePorts, hint: labels.activePortsHint, value: n(s?.activePorts) },
    { label: labels.listening, hint: labels.listeningHint, value: n(s?.listeningPorts) },
    { label: labels.established, hint: labels.establishedHint, value: n(s?.establishedConnections) },
    { label: labels.processes, hint: labels.processesHint, value: n(s?.uniqueProcesses) },
    {
      label: labels.lastRefresh,
      hint: labels.lastRefreshHint,
      value: snapshot ? formatTime(snapshot.scannedAtMs) : "–",
    },
  ];

  return (
    <dl className="grid grid-cols-5 divide-x divide-line rounded-lg border border-line bg-surface">
      {stats.map(({ label, value, hint }) => (
        <div key={label} title={hint} className="flex flex-col gap-1 px-4 py-3">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="font-mono text-xl tabular-nums text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
