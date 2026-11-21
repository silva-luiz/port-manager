import { useMemo, useState } from "react";
import { Notice } from "../../components/Notice";
import type { FavoritesState } from "../../hooks/useFavorites";
import type { PortSnapshotState } from "../../hooks/usePortSnapshot";
import { useI18n } from "../../i18n/I18nProvider";
import type { TerminationOutcome } from "../../types/process";
import { DetailsPanel } from "../process/DetailsPanel";
import { EndProcessDialog, type EndProcessTarget } from "../process/EndProcessDialog";
import {
  EMPTY_FILTERS,
  distinctProcessNames,
  distinctStates,
  entryKey,
  filterPorts,
  sortPorts,
  type PortFilters,
  type SortKey,
  type SortOrder,
} from "./portQuery";
import { PortsTable } from "./PortsTable";
import { PortsToolbar } from "./PortsToolbar";

interface PortsPageProps {
  ports: PortSnapshotState;
  favorites: FavoritesState;
}

export function PortsPage({ ports, favorites }: PortsPageProps) {
  const { t, formatNumber, formatTime, describeError } = useI18n();
  const { snapshot, error, loading, refresh } = ports;
  const [filters, setFilters] = useState<PortFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOrder>({ key: "localPort", direction: "asc" });
  // Store the key, not the row, so the panel always shows the latest data.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [endTarget, setEndTarget] = useState<EndProcessTarget | null>(null);
  // Stored as data so the message re-renders in a newly chosen language.
  const [ended, setEnded] = useState<TerminationOutcome | null>(null);

  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);
  const selected = useMemo(
    () => (selectedKey ? (entries.find((e) => entryKey(e) === selectedKey) ?? null) : null),
    [entries, selectedKey],
  );
  const processNames = useMemo(() => distinctProcessNames(entries), [entries]);
  const states = useMemo(() => distinctStates(entries), [entries]);
  const visible = useMemo(() => sortPorts(filterPorts(entries, filters), sort), [entries, filters, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" }));
  const toggleFavorite = (port: number) => void favorites.toggle(port);

  const handleEnded = (outcome: TerminationOutcome) => {
    setEndTarget(null);
    setEnded(outcome);
    void refresh();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <PortsToolbar
        filters={filters}
        onChange={setFilters}
        processNames={processNames}
        states={states}
        onRefresh={() => void refresh()}
        refreshing={loading}
      />

      {ended && (
        <Notice tone="ok" onDismiss={() => setEnded(null)}>
          {ended.exited ? t.ports.ended(ended.name, ended.pid) : t.ports.stillRunning(ended.name, ended.pid)}
        </Notice>
      )}
      {error && <Notice>{t.ports.listError(describeError(error))}</Notice>}
      {favorites.error && (
        <Notice onDismiss={favorites.clearError}>{t.favorites.updateError(describeError(favorites.error))}</Notice>
      )}
      {snapshot?.processLookupError && (
        <Notice tone="warn">{t.ports.processLookupWarning(describeError(snapshot.processLookupError))}</Notice>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-auto rounded-lg border border-line bg-surface">
          {snapshot === null ? (
            <p className="p-4 text-muted">{loading ? t.ports.loading : t.ports.noData}</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-muted">
              {t.ports.noMatches}{" "}
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-accent hover:underline">
                {t.common.clearFilters}
              </button>
            </p>
          ) : (
            <PortsTable
              entries={visible}
              sort={sort}
              onSort={toggleSort}
              selectedKey={selected ? selectedKey : null}
              onSelect={(entry) => setSelectedKey(entryKey(entry))}
              onEndProcess={setEndTarget}
              favoritePorts={favorites.ports}
              onToggleFavorite={toggleFavorite}
            />
          )}
        </div>

        {selected && (
          <DetailsPanel
            key={selectedKey}
            entry={selected}
            onClose={() => setSelectedKey(null)}
            onEndProcess={setEndTarget}
            isFavorite={favorites.ports.has(selected.localPort)}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </div>

      {snapshot && (
        <p className="text-xs text-muted">
          {t.ports.footer(formatNumber(visible.length), formatNumber(entries.length), formatTime(snapshot.scannedAtMs))}
        </p>
      )}

      {endTarget && (
        <EndProcessDialog target={endTarget} onCancel={() => setEndTarget(null)} onEnded={handleEnded} />
      )}
    </div>
  );
}
