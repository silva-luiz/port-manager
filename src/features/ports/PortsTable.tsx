import { ArrowDown, ArrowUp, Info, Power } from "lucide-react";
import { FavoriteButton } from "../../components/FavoriteButton";
import { useI18n } from "../../i18n/I18nProvider";
import type { Messages } from "../../i18n/en";
import { commandArgs } from "../../lib/commandLine";
import { PROTOCOL_LABELS } from "../../lib/labels";
import type { PortEntry } from "../../types/ports";
import type { EndProcessTarget } from "../process/EndProcessDialog";
import { entryKey, type SortKey, type SortOrder } from "./portQuery";
import { StateBadge } from "./StateBadge";

type ColumnId = keyof Messages["ports"]["columns"];

interface Column {
  id: ColumnId;
  sortKey: SortKey | null;
  className?: string;
}

const COLUMNS: Column[] = [
  { id: "port", sortKey: "localPort", className: "w-20" },
  { id: "protocol", sortKey: "protocol", className: "w-20" },
  { id: "localAddress", sortKey: "localAddress" },
  { id: "remote", sortKey: null },
  { id: "process", sortKey: "processName" },
  { id: "pid", sortKey: "pid", className: "w-20" },
  { id: "state", sortKey: "state", className: "w-32" },
  { id: "actions", sortKey: null, className: "w-24" },
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
  const { t } = useI18n();

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="border-b border-line">
          {COLUMNS.map(({ id, sortKey, className }) => (
            <th
              key={id}
              scope="col"
              aria-sort={
                sortKey && sort.key === sortKey ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
              }
              className={`h-8 px-3 text-xs font-medium text-muted ${className ?? ""}`}
            >
              {sortKey ? (
                <button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-fg">
                  {t.ports.columns[id]}
                  {sort.key === sortKey &&
                    (sort.direction === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                </button>
              ) : (
                t.ports.columns[id]
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => {
          const key = entryKey(e);
          const canEnd = e.pid !== null && e.processName !== null;
          return (
            <tr
              key={`${key}|${i}`}
              onClick={() => onSelect(e)}
              aria-selected={key === selectedKey}
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
                title={e.commandLine ?? e.processName ?? (e.pid === null ? t.ports.noOwner : t.ports.nameUnavailable)}
              >
                {e.processName ?? NONE}
                {e.commandLine && <span className="ml-2 font-mono text-[11px] text-muted">{commandArgs(e.commandLine)}</span>}
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
                    aria-label={t.ports.showDetails(e.localPort)}
                    title={t.ports.showDetailsTitle}
                  >
                    <Info size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${ICON_BUTTON} hover:text-danger`}
                    disabled={!canEnd}
                    onClick={() => canEnd && onEndProcess({ pid: e.pid!, name: e.processName! })}
                    aria-label={canEnd ? t.ports.endProcess(e.processName!, e.pid!) : t.ports.endUnavailable}
                    title={canEnd ? t.ports.endProcessTitle(e.processName!) : t.ports.endUnavailable}
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
