import type { HealthState } from "../../hooks/useHealthCheck";
import { formatTime } from "../../lib/labels";
import { RefreshButton } from "../RefreshButton";

interface HealthPanelProps {
  state: HealthState;
  onCheck: () => void;
}

export function HealthPanel({ state, onCheck }: HealthPanelProps) {
  return (
    <section aria-labelledby="health-title" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 id="health-title" className="font-medium">
          Backend health
        </h2>
        <RefreshButton onClick={onCheck} busy={state.phase === "checking"} label="Check again" />
      </div>
      <div className="px-4 py-3">
        <HealthBody state={state} />
      </div>
    </section>
  );
}

function HealthBody({ state }: { state: HealthState }) {
  if (state.phase === "checking") {
    return <p className="text-muted">Contacting the Rust backend…</p>;
  }

  if (state.phase === "offline") {
    return (
      <p className="text-danger">
        The frontend couldn't reach the Rust backend: {state.error}. If this page is open in a
        browser, start the app with <code className="font-mono">npm run tauri dev</code> instead.
      </p>
    );
  }

  const { health, latencyMs } = state;
  const rows: [string, string][] = [
    ["Status", health.status],
    ["App version", health.appVersion],
    ["Platform", `${health.os} (${health.arch})`],
    ["Round trip", `${latencyMs.toFixed(1)} ms`],
    ["Checked at", formatTime(health.timestampMs)],
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
