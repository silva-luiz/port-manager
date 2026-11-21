import { useMemo } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { PortSnapshot } from "../../types/ports";
import { listeningByProcess } from "./listening";

/** What is accepting connections on this machine, one row per process. */
export function ListeningPanel({ snapshot }: { snapshot: PortSnapshot | null }) {
  const { t } = useI18n();
  const groups = useMemo(() => listeningByProcess(snapshot?.entries ?? []), [snapshot]);

  return (
    <section aria-labelledby="listening-title" className="rounded-lg border border-line bg-surface">
      <h2 id="listening-title" className="border-b border-line px-4 py-2.5 font-medium">
        {t.dashboard.listeningTitle}
      </h2>
      {groups.length === 0 ? (
        <p className="px-4 py-3 text-muted">{snapshot ? t.dashboard.listeningEmpty : t.ports.loading}</p>
      ) : (
        <ul className="divide-y divide-line">
          {groups.map((g) => (
            <li key={String(g.pid)} className="flex items-baseline gap-3 px-4 py-2">
              <span className="w-56 shrink-0 truncate" title={g.processName ?? undefined}>
                {g.processName ?? t.details.unknownProcess}
                {g.pid !== null && <span className="ml-1.5 font-mono text-[12px] text-muted">({g.pid})</span>}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {g.ports.map((port) => (
                  <span key={port} className="rounded bg-ok/10 px-1.5 py-px font-mono text-[12px] text-ok">
                    {port}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
