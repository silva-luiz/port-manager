import { Notice } from "../../components/Notice";
import { HealthPanel } from "../../components/health/HealthPanel";
import { RefreshButton } from "../../components/RefreshButton";
import type { HealthState } from "../../hooks/useHealthCheck";
import type { PortSnapshotState } from "../../hooks/usePortSnapshot";
import { useI18n } from "../../i18n/I18nProvider";
import { SummaryStrip } from "./SummaryStrip";

interface DashboardPageProps {
  ports: PortSnapshotState;
  health: HealthState;
  onCheckHealth: () => void;
}

export function DashboardPage({ ports, health, onCheckHealth }: DashboardPageProps) {
  const { t, describeError } = useI18n();
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted">{t.dashboard.intro}</p>
        <RefreshButton onClick={() => void ports.refresh()} busy={ports.loading} shortcut="F5" />
      </div>
      {ports.error && <Notice>{t.ports.listError(describeError(ports.error))}</Notice>}
      <SummaryStrip snapshot={ports.snapshot} />
      <HealthPanel state={health} onCheck={onCheckHealth} />
    </div>
  );
}
