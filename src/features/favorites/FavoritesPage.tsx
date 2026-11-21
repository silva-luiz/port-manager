import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Notice } from "../../components/Notice";
import { RefreshButton } from "../../components/RefreshButton";
import type { FavoritesState } from "../../hooks/useFavorites";
import type { PortSnapshotState } from "../../hooks/usePortSnapshot";
import { useI18n } from "../../i18n/I18nProvider";
import { parsePort } from "../ports/portQuery";
import { favoriteUsage, type PortOwner } from "./favoriteUsage";

interface FavoritesPageProps {
  favorites: FavoritesState;
  ports: PortSnapshotState;
}

export function FavoritesPage({ favorites, ports }: FavoritesPageProps) {
  const { t, describeError } = useI18n();
  const [input, setInput] = useState("");
  const [inputInvalid, setInputInvalid] = useState(false);
  const usage = useMemo(
    () => favoriteUsage(favorites.favorites, ports.snapshot?.entries ?? []),
    [favorites.favorites, ports.snapshot],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const port = parsePort(input);
    if (port === null || port === 0) {
      setInputInvalid(true);
      return;
    }
    setInputInvalid(false);
    if (await favorites.add(port)) setInput("");
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <form onSubmit={(e) => void submit(e)} className="flex items-start gap-2" noValidate>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t.favorites.inputLabel}</span>
            <input
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.favorites.inputPlaceholder}
              aria-invalid={inputInvalid}
              aria-describedby={inputInvalid ? "favorite-error" : undefined}
              className="h-8 w-40 rounded-md border border-line bg-surface px-2.5 font-mono text-[13px] placeholder:font-sans placeholder:text-muted/70 focus:border-accent/60 focus:outline-none aria-invalid:border-danger/70"
            />
            {inputInvalid && (
              <span id="favorite-error" className="text-xs text-danger">
                {t.favorites.invalidPort}
              </span>
            )}
          </label>
          <button
            type="submit"
            className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-muted hover:border-accent/50 hover:text-fg"
          >
            <Plus size={13} aria-hidden />
            {t.favorites.addButton}
          </button>
        </form>
        <RefreshButton onClick={() => void ports.refresh()} busy={ports.loading} label={t.favorites.refreshStatus} />
      </div>

      {favorites.error && (
        <Notice onDismiss={favorites.clearError}>{t.favorites.updateError(describeError(favorites.error))}</Notice>
      )}
      {ports.error && <Notice>{t.favorites.staleWarning(describeError(ports.error))}</Notice>}

      {usage.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-muted">{t.favorites.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {usage.map(({ port, inUse, owners }) => (
            <li key={port} className="flex items-center gap-4 px-4 py-2.5">
              <span className="w-16 font-mono text-sm tabular-nums">{port}</span>
              <span className={`flex w-24 items-center gap-1.5 text-xs ${inUse ? "text-ok" : "text-muted"}`}>
                <span className={`size-1.5 rounded-full ${inUse ? "bg-ok" : "bg-muted/50"}`} aria-hidden />
                {inUse ? t.favorites.inUse : t.favorites.free}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted">
                {owners.length === 0 ? t.favorites.noSockets : <OwnerList owners={owners} />}
              </span>
              <button
                type="button"
                onClick={() => void favorites.remove(port)}
                aria-label={t.favorites.removeLabel(port)}
                title={t.favorites.removeTitle}
                className="grid size-7 place-items-center rounded text-muted hover:bg-raised hover:text-danger"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OwnerList({ owners }: { owners: PortOwner[] }) {
  const { t } = useI18n();
  const text = owners
    .map((o) => {
      const name = o.processName ?? t.favorites.unknownProcess;
      const pid = o.pid !== null ? ` (PID ${o.pid})` : "";
      const states = o.states.map((s) => t.states[s]).join(", ");
      return `${name}${pid}: ${states}`;
    })
    .join("; ");
  return <>{text}</>;
}
