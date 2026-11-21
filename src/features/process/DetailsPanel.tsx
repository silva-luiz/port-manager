import { Power, X } from "lucide-react";
import type { ReactNode } from "react";
import { FavoriteButton } from "../../components/FavoriteButton";
import { useProcessDetails } from "../../hooks/useProcessDetails";
import { PROTOCOL_LABELS } from "../../lib/labels";
import type { PortEntry } from "../../types/ports";
import { StateBadge } from "../ports/StateBadge";
import type { EndProcessTarget } from "./EndProcessDialog";

interface DetailsPanelProps {
  entry: PortEntry;
  onClose: () => void;
  onEndProcess: (target: EndProcessTarget) => void;
  isFavorite: boolean;
  onToggleFavorite: (port: number) => void;
}

export function DetailsPanel({ entry, onClose, onEndProcess, isFavorite, onToggleFavorite }: DetailsPanelProps) {
  const details = useProcessDetails(entry.pid);
  const name = details.phase === "loaded" ? details.details.name : entry.processName;

  return (
    <aside
      aria-labelledby="details-title"
      className="flex w-80 shrink-0 flex-col overflow-auto rounded-lg border border-line bg-surface"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 id="details-title" className="truncate font-medium" title={name ?? undefined}>
          {name ?? "Unknown process"}
        </h2>
        <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label="Close details">
          <X size={15} aria-hidden />
        </button>
      </div>

      <Section title="Process">
        <Field label="Name">{name ?? <Missing>No owning process</Missing>}</Field>
        <Field label="PID" mono>
          {entry.pid ?? <Missing>None</Missing>}
        </Field>
        <Field label="Executable">
          <ExecutablePath entry={entry} state={details} />
        </Field>
      </Section>

      <Section title="Connection">
        <Field label="Port" mono>
          <span className="flex items-center gap-1">
            {entry.localPort}
            <FavoriteButton port={entry.localPort} active={isFavorite} onToggle={onToggleFavorite} />
          </span>
        </Field>
        <Field label="Protocol">{PROTOCOL_LABELS[entry.protocol]}</Field>
        <Field label="Local" mono>
          {entry.localAddress}
        </Field>
        <Field label="Remote" mono>
          {entry.remoteAddress !== null ? `${entry.remoteAddress}:${entry.remotePort}` : <Missing>None</Missing>}
        </Field>
        <Field label="State">
          <StateBadge state={entry.state} />
        </Field>
      </Section>

      <div className="mt-auto border-t border-line p-4">
        <button
          type="button"
          disabled={entry.pid === null || name === null}
          onClick={() => entry.pid !== null && name && onEndProcess({ pid: entry.pid, name })}
          title={entry.pid === null ? "This socket has no owning process" : undefined}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-danger/40 text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Power size={14} aria-hidden />
          End process…
        </button>
      </div>
    </aside>
  );
}

function ExecutablePath({ entry, state }: { entry: PortEntry; state: ReturnType<typeof useProcessDetails> }) {
  if (entry.pid === null) return <Missing>None</Missing>;
  switch (state.phase) {
    case "none":
    case "loading":
      return <span className="text-muted">Loading…</span>;
    case "error":
      return <span className="text-warn">{state.error}</span>;
    case "loaded":
      return state.details.executablePath ? (
        <span className="font-mono text-[12px] break-all select-text">{state.details.executablePath}</span>
      ) : (
        <span className="text-muted">Unavailable. {state.details.pathUnavailableReason}</span>
      );
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3 last-of-type:border-b-0">
      <h3 className="mb-2 text-xs text-muted">{title}</h3>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1.5">{children}</dl>
    </section>
  );
}

function Field({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={`min-w-0 ${mono ? "font-mono text-[12px]" : ""}`}>{children}</dd>
    </>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <span className="text-muted/70">{children}</span>;
}
