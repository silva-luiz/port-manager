import { useI18n } from "../../i18n/I18nProvider";
import type { ProcessRef } from "../../types/process";

const VISIBLE = 5;

/** Compact "name (PID)" list that collapses long lists into "and N more". */
export function ProcessList({ processes }: { processes: ProcessRef[] }) {
  const { t } = useI18n();
  const hidden = processes.length - VISIBLE;
  return (
    <ul className="flex flex-col gap-0.5">
      {processes.slice(0, VISIBLE).map((p) => (
        <li key={p.pid} className="truncate">
          {p.name} <span className="font-mono text-[12px] text-muted">({p.pid})</span>
        </li>
      ))}
      {hidden > 0 && <li className="text-muted">{t.endDialog.andMore(hidden)}</li>}
    </ul>
  );
}
