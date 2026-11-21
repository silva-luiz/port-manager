import { Notice } from "../../components/Notice";
import { HealthPanel } from "../../components/health/HealthPanel";
import { RefreshButton } from "../../components/RefreshButton";
import type { HealthState } from "../../hooks/useHealthCheck";
import type { PortSnapshotState } from "../../hooks/usePortSnapshot";
import { SummaryStrip } from "./SummaryStrip";

interface DashboardPageProps {
  ports: PortSnapshotState;
  health: HealthState;
  onCheckHealth: () => void;
}

export function DashboardPage({ ports, health, onCheckHealth }: DashboardPageProps) {
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted">TCP sockets on this machine, read from the Windows connection table.</p>
        <RefreshButton onClick={() => void ports.refresh()} busy={ports.loading} />
      </div>
      {ports.error && <Notice>Couldn't read the port list: {ports.error}</Notice>}
      <SummaryStrip snapshot={ports.snapshot} />
      <HealthPanel state={health} onCheck={onCheckHealth} />
    </div>
  );
}
