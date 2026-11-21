import { useMemo, useState } from "react";
import { Notice } from "../../components/Notice";
import type { FavoritesState } from "../../hooks/useFavorites";
import type { PortSnapshotState } from "../../hooks/usePortSnapshot";
import { formatTime } from "../../lib/labels";
import type { PortEntry } from "../../types/ports";
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

export function PortsPage({ ports, favorites }: { ports: PortSnapshotState; favorites: FavoritesState }) {
  const { snapshot, error, loading, refresh } = ports;
  const [filters, setFilters] = useState<PortFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOrder>({ key: "localPort", direction: "asc" });
  const [selected, setSelected] = useState<PortEntry | null>(null);
  const [endTarget, setEndTarget] = useState<EndProcessTarget | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);
  const processNames = useMemo(() => distinctProcessNames(entries), [entries]);
  const states = useMemo(() => distinctStates(entries), [entries]);
  const visible = useMemo(() => sortPorts(filterPorts(entries, filters), sort), [entries, filters, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" }));

  const handleEnded = (outcome: TerminationOutcome) => {
    setEndTarget(null);
    setSelected((s) => (s?.pid === outcome.pid ? null : s));
    setResult(
      outcome.exited
        ? `Ended ${outcome.name} (PID ${outcome.pid}).`
        : `Asked ${outcome.name} (PID ${outcome.pid}) to stop, but it was still running after 3 seconds.`,
    );
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

      {result && (
        <Notice tone="ok" onDismiss={() => setResult(null)}>
          {result}
        </Notice>
      )}
      {error && <Notice>Couldn't read the port list: {error}</Notice>}
      {favorites.error && (
        <Notice onDismiss={favorites.clearError}>Couldn't update favorites: {favorites.error}</Notice>
      )}
      {snapshot?.processLookupError && (
        <Notice tone="warn">Ports were read, but process names are unavailable: {snapshot.processLookupError}</Notice>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-auto rounded-lg border border-line bg-surface">
          {snapshot === null ? (
            <p className="p-4 text-muted">{loading ? "Reading the connection table…" : "No port data yet."}</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-muted">
              No sockets match these filters.{" "}
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-accent hover:underline">
                Clear filters
              </button>
            </p>
          ) : (
            <PortsTable
              entries={visible}
              sort={sort}
              onSort={toggleSort}
              selectedKey={selected ? entryKey(selected) : null}
              onSelect={setSelected}
              onEndProcess={setEndTarget}
              favoritePorts={favorites.ports}
              onToggleFavorite={(port) => void favorites.toggle(port)}
            />
          )}
        </div>

        {selected && (
          <DetailsPanel
            key={entryKey(selected)}
            entry={selected}
            onClose={() => setSelected(null)}
            onEndProcess={setEndTarget}
            isFavorite={favorites.ports.has(selected.localPort)}
            onToggleFavorite={(port) => void favorites.toggle(port)}
          />
        )}
      </div>

      {snapshot && (
        <p className="text-xs text-muted">
          Showing {visible.length.toLocaleString()} of {entries.length.toLocaleString()} sockets, read at{" "}
          {formatTime(snapshot.scannedAtMs)}. Select a row for process details.
        </p>
      )}

      {endTarget && (
        <EndProcessDialog target={endTarget} onCancel={() => setEndTarget(null)} onEnded={handleEnded} />
      )}
    </div>
  );
}
