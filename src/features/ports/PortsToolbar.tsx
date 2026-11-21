import { Search, X } from "lucide-react";
import { RefreshButton } from "../../components/RefreshButton";
import { useI18n } from "../../i18n/I18nProvider";
import type { TcpState } from "../../types/ports";
import { EMPTY_FILTERS, hasActiveFilters, parsePort, type PortFilters } from "./portQuery";

interface PortsToolbarProps {
  filters: PortFilters;
  onChange: (filters: PortFilters) => void;
  processNames: string[];
  states: TcpState[];
  onRefresh: () => void;
  refreshing: boolean;
}

const FIELD =
  "h-8 rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg placeholder:text-muted/70 focus:border-accent/60 focus:outline-none";

export function PortsToolbar({ filters, onChange, processNames, states, onRefresh, refreshing }: PortsToolbarProps) {
  const { t } = useI18n();
  const set = <K extends keyof PortFilters>(key: K, value: PortFilters[K]) => onChange({ ...filters, [key]: value });
  const portInvalid = filters.port.trim() !== "" && parsePort(filters.port) === null;
  const hasFilters = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-56 flex-1">
        <span className="sr-only">{t.ports.searchLabel}</span>
        <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder={t.ports.searchPlaceholder}
          className={`${FIELD} w-full pl-8`}
        />
      </label>

      <label>
        <span className="sr-only">{t.ports.portLabel}</span>
        <input
          inputMode="numeric"
          value={filters.port}
          onChange={(e) => set("port", e.target.value)}
          placeholder={t.ports.portPlaceholder}
          aria-invalid={portInvalid}
          title={portInvalid ? t.ports.portInvalid : t.ports.portHint}
          className={`${FIELD} w-24 font-mono aria-invalid:border-danger/70`}
        />
      </label>

      <label>
        <span className="sr-only">{t.ports.processLabel}</span>
        <select value={filters.processName} onChange={(e) => set("processName", e.target.value)} className={`${FIELD} max-w-48`}>
          <option value="">{t.ports.allProcesses}</option>
          {processNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">{t.ports.stateLabel}</span>
        <select value={filters.state} onChange={(e) => set("state", e.target.value as TcpState | "")} className={FIELD}>
          <option value="">{t.ports.allStates}</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {t.states[state]}
            </option>
          ))}
        </select>
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:text-fg"
        >
          <X size={13} aria-hidden />
          {t.common.clearFilters}
        </button>
      )}

      <div className="ml-auto">
        <RefreshButton onClick={onRefresh} busy={refreshing} />
      </div>
    </div>
  );
}
