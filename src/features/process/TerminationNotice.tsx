import { Notice } from "../../components/Notice";
import { useI18n } from "../../i18n/I18nProvider";
import type { TerminationOutcome } from "../../types/process";

/** Result of an end-process action, including any children that survived. */
export function TerminationNotice({ outcome, onDismiss }: { outcome: TerminationOutcome; onDismiss: () => void }) {
  const { t, describeError } = useI18n();
  const { name, pid, exited, children } = outcome;
  const failed = children.filter((c) => c.error !== null);
  const ended = children.length - failed.length;

  const headline = !exited
    ? t.ports.stillRunning(name, pid)
    : ended > 0
      ? t.ports.endedWithChildren(name, pid, ended)
      : t.ports.ended(name, pid);

  return (
    <Notice tone={exited && failed.length === 0 ? "ok" : "warn"} onDismiss={onDismiss}>
      {headline}
      {failed.length > 0 && (
        <>
          {" "}
          {t.ports.childFailures(failed.length)}
          <span className="mt-1 block">
            {failed.map((c) => (
              <span key={c.pid} className="block">
                {c.name} <span className="font-mono text-[12px]">({c.pid})</span>: {describeError(c.error!)}
              </span>
            ))}
          </span>
        </>
      )}
    </Notice>
  );
}
