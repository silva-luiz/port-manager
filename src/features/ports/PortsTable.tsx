import { ArrowDown, ArrowUp, Info, Power } from "lucide-react";
import { FavoriteButton } from "../../components/FavoriteButton";
import { PROTOCOL_LABELS } from "../../lib/labels";
import type { PortEntry } from "../../types/ports";
import type { EndProcessTarget } from "../process/EndProcessDialog";
import { entryKey, type SortKey, type SortOrder } from "./portQuery";
import { StateBadge } from "./StateBadge";

interface Column {
  key: SortKey | null;
  label: string;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: "localPort", label: "Port", className: "w-20" },
  { key: "protocol", label: "Protocol", className: "w-20" },
  { key: "localAddress", label: "Local address" },
  { key: null, label: "Remote" },
  { key: "processName", label: "Process" },
  { key: "pid", label: "PID", className: "w-20" },
  { key: "state", label: "State", className: "w-32" },
  { key: null, label: "Actions", className: "w-24" },
];

interface PortsTableProps {
  entries: PortEntry[];
  sort: SortOrder;
  onSort: (key: SortKey) => void;
  selectedKey: string | null;
  onSelect: (entry: PortEntry) => void;
  onEndProcess: (target: EndProcessTarget) => void;
  favoritePorts: Set<number>;
  onToggleFavorite: (port: number) => void;
}

const NONE = <span className="text-muted/60">—</span>;

const ICON_BUTTON =
  "grid size-6 place-items-center rounded text-muted hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-30";

export function PortsTable({
  entries,
  sort,
  onSort,
  selectedKey,
  onSelect,
  onEndProcess,
  favoritePorts,
  onToggleFavorite,
}: PortsTableProps) {
  return (
    <table className="w-full table-fixed border-collapse text-left">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="border-b border-line">
          {COLUMNS.map(({ key, label, className }) => (
            <th
              key={label}
              scope="col"
              aria-sort={key && sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
              className={`h-8 px-3 text-xs font-medium text-muted ${className ?? ""}`}
            >
              {key ? (
                <button type="button" onClick={() => onSort(key)} className="flex items-center gap-1 hover:text-fg">
                  {label}
                  {sort.key === key &&
                    (sort.direction === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                </button>
              ) : (
                label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => {
          const key = entryKey(e);
          const selected = key === selectedKey;
          const canEnd = e.pid !== null && e.processName !== null;
          return (
            <tr
              key={`${key}|${i}`}
              onClick={() => onSelect(e)}
              aria-selected={selected}
              className="h-8 cursor-default border-b border-line/60 hover:bg-raised/60 aria-selected:bg-accent/10"
            >
              <td className="px-3 font-mono text-[12px] tabular-nums">{e.localPort}</td>
              <td className="px-3 text-muted">{PROTOCOL_LABELS[e.protocol]}</td>
              <td className="truncate px-3 font-mono text-[12px]" title={e.localAddress}>
                {e.localAddress}
              </td>
              <td className="truncate px-3 font-mono text-[12px] text-muted">
                {e.remoteAddress !== null ? `${e.remoteAddress}:${e.remotePort}` : NONE}
              </td>
              <td
                className="truncate px-3"
                title={
                  e.processName ??
                  (e.pid === null ? "Not owned by a process" : "Process name unavailable (it may have exited)")
                }
              >
                {e.processName ?? NONE}
              </td>
              <td className="px-3 font-mono text-[12px] tabular-nums text-muted">{e.pid ?? NONE}</td>
              <td className="px-3">
                <StateBadge state={e.state} />
              </td>
              <td className="px-2">
                <div className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                  <FavoriteButton port={e.localPort} active={favoritePorts.has(e.localPort)} onToggle={onToggleFavorite} />
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    onClick={() => onSelect(e)}
                    aria-label={`Show details for port ${e.localPort}`}
                    title="Show details"
                  >
                    <Info size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${ICON_BUTTON} hover:text-danger`}
                    disabled={!canEnd}
                    onClick={() => canEnd && onEndProcess({ pid: e.pid!, name: e.processName! })}
                    aria-label={canEnd ? `End ${e.processName} (PID ${e.pid})` : "End process unavailable"}
                    title={canEnd ? `End ${e.processName}…` : "No identifiable process to end"}
                  >
                    <Power size={14} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
