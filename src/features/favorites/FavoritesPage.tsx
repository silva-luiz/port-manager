import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Notice } from "../../components/Notice";
import { RefreshButton } from "../../components/RefreshButton";
import type { FavoritesState } from "../../hooks/useFavorites";
import type { PortSnapshotState } from "../../hooks/usePortSnapshot";
import { STATE_LABELS } from "../../lib/labels";
import { parsePort } from "../ports/portQuery";
import { favoriteUsage } from "./favoriteUsage";

interface FavoritesPageProps {
  favorites: FavoritesState;
  ports: PortSnapshotState;
}

export function FavoritesPage({ favorites, ports }: FavoritesPageProps) {
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const usage = useMemo(
    () => favoriteUsage(favorites.favorites, ports.snapshot?.entries ?? []),
    [favorites.favorites, ports.snapshot],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const port = parsePort(input);
    if (port === null || port === 0) {
      setInputError("Enter a port between 1 and 65535.");
      return;
    }
    setInputError(null);
    if (await favorites.add(port)) setInput("");
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <form onSubmit={(e) => void submit(e)} className="flex items-start gap-2" noValidate>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Port number</span>
            <input
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Port, e.g. 3000"
              aria-invalid={inputError !== null}
              aria-describedby={inputError ? "favorite-error" : undefined}
              className="h-8 w-40 rounded-md border border-line bg-surface px-2.5 font-mono text-[13px] placeholder:font-sans placeholder:text-muted/70 focus:border-accent/60 focus:outline-none aria-invalid:border-danger/70"
            />
            {inputError && (
              <span id="favorite-error" className="text-xs text-danger">
                {inputError}
              </span>
            )}
          </label>
          <button
            type="submit"
            className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-muted hover:border-accent/50 hover:text-fg"
          >
            <Plus size={13} aria-hidden />
            Add favorite
          </button>
        </form>
        <RefreshButton onClick={() => void ports.refresh()} busy={ports.loading} label="Refresh status" />
      </div>

      {favorites.error && (
        <Notice onDismiss={favorites.clearError}>Couldn't update favorites: {favorites.error}</Notice>
      )}
      {ports.error && <Notice>Couldn't read the port list, so usage may be out of date: {ports.error}</Notice>}

      {usage.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-muted">
          No favorite ports yet. Add one above, or star a row on the Ports page.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {usage.map(({ port, inUse, owners }) => (
            <li key={port} className="flex items-center gap-4 px-4 py-2.5">
              <span className="w-16 font-mono text-sm tabular-nums">{port}</span>
              <span className={`flex w-24 items-center gap-1.5 text-xs ${inUse ? "text-ok" : "text-muted"}`}>
                <span className={`size-1.5 rounded-full ${inUse ? "bg-ok" : "bg-muted/50"}`} aria-hidden />
                {inUse ? "In use" : "Free"}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted">
                {owners.length === 0
                  ? "No sockets on this port"
                  : owners
                      .map(
                        (o) =>
                          `${o.processName ?? "Unknown process"}${o.pid !== null ? ` (PID ${o.pid})` : ""}: ${o.states
                            .map((s) => STATE_LABELS[s].toLowerCase())
                            .join(", ")}`,
                      )
                      .join("; ")}
              </span>
              <button
                type="button"
                onClick={() => void favorites.remove(port)}
                aria-label={`Remove port ${port} from favorites`}
                title="Remove from favorites"
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
