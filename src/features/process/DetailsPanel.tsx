import { Power, X } from "lucide-react";
import type { ReactNode } from "react";
import { FavoriteButton } from "../../components/FavoriteButton";
import { useProcessDetails, type ProcessDetailsState } from "../../hooks/useProcessDetails";
import { useI18n } from "../../i18n/I18nProvider";
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
  const { t } = useI18n();
  const details = useProcessDetails(entry.pid);
  const name = details.phase === "loaded" ? details.details.name : entry.processName;

  return (
    <aside
      aria-labelledby="details-title"
      className="flex w-80 shrink-0 flex-col overflow-auto rounded-lg border border-line bg-surface"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 id="details-title" className="truncate font-medium" title={name ?? undefined}>
          {name ?? t.details.unknownProcess}
        </h2>
        <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label={t.details.close}>
          <X size={15} aria-hidden />
        </button>
      </div>

      <Section title={t.details.process}>
        <Field label={t.details.name}>{name ?? <Missing>{t.details.noOwner}</Missing>}</Field>
        <Field label={t.details.pid} mono>
          {entry.pid ?? <Missing>{t.common.none}</Missing>}
        </Field>
        <Field label={t.details.executable}>
          <ExecutablePath entry={entry} state={details} />
        </Field>
      </Section>

      <Section title={t.details.connection}>
        <Field label={t.details.port} mono>
          <span className="flex items-center gap-1">
            {entry.localPort}
            <FavoriteButton port={entry.localPort} active={isFavorite} onToggle={onToggleFavorite} />
          </span>
        </Field>
        <Field label={t.details.protocol}>{PROTOCOL_LABELS[entry.protocol]}</Field>
        <Field label={t.details.local} mono>
          {entry.localAddress}
        </Field>
        <Field label={t.details.remote} mono>
          {entry.remoteAddress !== null ? (
            `${entry.remoteAddress}:${entry.remotePort}`
          ) : (
            <Missing>{t.common.none}</Missing>
          )}
        </Field>
        <Field label={t.details.state}>
          <StateBadge state={entry.state} />
        </Field>
      </Section>

      <div className="mt-auto border-t border-line p-4">
        <button
          type="button"
          disabled={entry.pid === null || name === null}
          onClick={() => entry.pid !== null && name && onEndProcess({ pid: entry.pid, name })}
          title={entry.pid === null ? t.details.noOwnerTitle : undefined}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-danger/40 text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Power size={14} aria-hidden />
          {t.details.endProcess}
        </button>
      </div>
    </aside>
  );
}

function ExecutablePath({ entry, state }: { entry: PortEntry; state: ProcessDetailsState }) {
  const { t, describeError } = useI18n();
  if (entry.pid === null) return <Missing>{t.common.none}</Missing>;
  switch (state.phase) {
    case "none":
    case "loading":
      return <span className="text-muted">{t.details.loading}</span>;
    case "error":
      return <span className="text-warn">{describeError(state.error)}</span>;
    case "loaded": {
      const { executablePath, pathError } = state.details;
      if (executablePath) {
        return <span className="font-mono text-[12px] break-all select-text">{executablePath}</span>;
      }
      return (
        <span className="text-muted">{t.details.pathUnavailable(pathError ? describeError(pathError) : "")}</span>
      );
    }
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
