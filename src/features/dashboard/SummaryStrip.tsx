import { formatTime } from "../../lib/labels";
import type { PortSnapshot } from "../../types/ports";

interface Stat {
  label: string;
  value: string;
  hint: string;
}

function toStats(snapshot: PortSnapshot | null): Stat[] {
  const s = snapshot?.summary;
  const n = (v: number | undefined) => (v === undefined ? "–" : v.toLocaleString());
  return [
    { label: "Active ports", value: n(s?.activePorts), hint: "Distinct local TCP ports with a live socket (excludes time wait)" },
    { label: "Listening", value: n(s?.listeningPorts), hint: "Distinct local ports accepting connections" },
    { label: "Established", value: n(s?.establishedConnections), hint: "Open TCP connections" },
    { label: "Processes", value: n(s?.uniqueProcesses), hint: "Distinct processes owning at least one socket" },
    { label: "Last refresh", value: snapshot ? formatTime(snapshot.scannedAtMs) : "–", hint: "When the port list was last read" },
  ];
}

export function SummaryStrip({ snapshot }: { snapshot: PortSnapshot | null }) {
  return (
    <dl className="grid grid-cols-5 divide-x divide-line rounded-lg border border-line bg-surface">
      {toStats(snapshot).map(({ label, value, hint }) => (
        <div key={label} title={hint} className="flex flex-col gap-1 px-4 py-3">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="font-mono text-xl tabular-nums text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
