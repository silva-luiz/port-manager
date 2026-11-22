import { Power, X } from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "../../components/CopyButton";
import { FavoriteButton } from "../../components/FavoriteButton";
import { usePanelWidth } from "../../hooks/usePanelWidth";
import { useProcessDetails, type ProcessDetailsState } from "../../hooks/useProcessDetails";
import { useI18n } from "../../i18n/I18nProvider";
import { PROTOCOL_LABELS } from "../../lib/labels";
import type { PortEntry } from "../../types/ports";
import type { ProcessDetails, ProcessRef } from "../../types/process";
import { StateBadge } from "../ports/StateBadge";
import type { EndProcessTarget } from "./EndProcessDialog";
import { ProcessList } from "./ProcessList";
import { RevealButton } from "./RevealButton";

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
  const panel = usePanelWidth();

  return (
    <div className="relative flex shrink-0" style={{ width: panel.width }}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t.details.resize}
        aria-valuenow={panel.width}
        aria-valuemin={panel.min}
        aria-valuemax={panel.max}
        tabIndex={0}
        title={t.details.resizeTitle}
        {...panel.handleProps}
        className="group absolute inset-y-0 -left-2.5 z-10 flex w-2 cursor-col-resize touch-none justify-center outline-none"
      >
        <span className="h-full w-0.5 rounded-full bg-transparent transition-colors group-hover:bg-accent/60 group-focus-visible:bg-accent group-active:bg-accent" />
      </div>
      <aside
        aria-labelledby="details-title"
        className="flex min-w-0 flex-1 flex-col overflow-auto rounded-lg border border-line bg-surface"
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
          <Field label={t.details.pid} mono copy={entry.pid?.toString()}>
            {entry.pid ?? <Missing>{t.common.none}</Missing>}
          </Field>
          <Field
            label={t.details.executable}
            copy={details.phase === "loaded" ? (details.details.executablePath ?? undefined) : undefined}
          >
            <ExecutablePath entry={entry} state={details} />
          </Field>
          {details.phase === "loaded" && <Lineage details={details.details} onEndProcess={onEndProcess} />}
        </Section>

        <Section title={t.details.connection}>
          <Field label={t.details.port} mono>
            <span className="flex items-center gap-1">
              {entry.localPort}
              <CopyButton value={String(entry.localPort)} label={t.details.port} />
              <FavoriteButton port={entry.localPort} active={isFavorite} onToggle={onToggleFavorite} />
            </span>
          </Field>
          <Field label={t.details.protocol}>{PROTOCOL_LABELS[entry.protocol]}</Field>
          <Field label={t.details.local} mono copy={entry.localAddress}>
            {entry.localAddress}
          </Field>
          <Field
            label={t.details.remote}
            mono
            copy={entry.remoteAddress !== null ? `${entry.remoteAddress}:${entry.remotePort}` : undefined}
          >
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
    </div>
  );
}

/** Command line, the parent process (which can be ended from here) and children. */
function Lineage({
  details,
  onEndProcess,
}: {
  details: ProcessDetails;
  onEndProcess: (target: EndProcessTarget) => void;
}) {
  const { t } = useI18n();
  const { commandLine, parent, mainProcess, descendants } = details;
  return (
    <>
      <Field label={t.details.commandLine} copy={commandLine ?? undefined}>
        {commandLine ? (
          <span className="font-mono text-[12px] break-all select-text">{commandLine}</span>
        ) : (
          <Missing>{t.common.none}</Missing>
        )}
      </Field>
      <Field label={t.details.mainProcess}>
        {mainProcess ? (
          <EndableProcess process={mainProcess} title={t.details.endMainTitle(mainProcess.name)} onEnd={onEndProcess} />
        ) : (
          <span className="text-muted">{t.details.isMainProcess}</span>
        )}
      </Field>
      <Field label={t.details.parent}>
        {parent ? (
          <EndableProcess process={parent} title={t.details.endParentTitle(parent.name)} onEnd={onEndProcess} />
        ) : (
          <Missing>{t.common.none}</Missing>
        )}
      </Field>
      <Field label={t.details.children}>
        {descendants.length > 0 ? <ProcessList processes={descendants} /> : <Missing>{t.common.none}</Missing>}
      </Field>
    </>
  );
}

/** "name (PID)" followed by an "End…" link. */
function EndableProcess({
  process,
  title,
  onEnd,
}: {
  process: ProcessRef;
  title: string;
  onEnd: (target: EndProcessTarget) => void;
}) {
  const { t } = useI18n();
  return (
    <span className="flex items-baseline gap-2">
      <span className="min-w-0 truncate">
        {process.name} <span className="font-mono text-[12px] text-muted">({process.pid})</span>
      </span>
      <button
        type="button"
        onClick={() => onEnd(process)}
        title={title}
        className="shrink-0 text-xs text-danger hover:underline"
      >
        {t.details.endParent}
      </button>
    </span>
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
        return (
          <>
            <span className="font-mono text-[12px] break-all select-text">{executablePath}</span>
            <RevealButton pid={entry.pid} />
          </>
        );
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

interface FieldProps {
  label: string;
  mono?: boolean;
  /** When set, a copy-to-clipboard button for this value follows the content. */
  copy?: string;
  children: ReactNode;
}

function Field({ label, mono, copy, children }: FieldProps) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={`min-w-0 ${mono ? "font-mono text-[12px]" : ""}`}>
        {children}
        {copy && <CopyButton value={copy} label={label} />}
      </dd>
    </>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <span className="text-muted/70">{children}</span>;
}
