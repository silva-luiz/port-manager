import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { api, toAppError } from "../../lib/api";
import type { AppError } from "../../types/error";
import type { TerminationOutcome } from "../../types/process";

export interface EndProcessTarget {
  pid: number;
  name: string;
}

interface EndProcessDialogProps {
  target: EndProcessTarget;
  onCancel: () => void;
  onEnded: (outcome: TerminationOutcome) => void;
}

/**
 * Modal confirmation shown before any process is ended. Nothing is sent to
 * the backend until the user presses the confirm button here.
 */
export function EndProcessDialog({ target, onCancel, onEnded }: EndProcessDialogProps) {
  const { t, describeError } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      onEnded(await api.terminateProcess(target.pid, target.name));
    } catch (e) {
      setError(toAppError(e));
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      aria-labelledby="end-process-title"
      className="m-auto w-[26rem] rounded-lg border border-line bg-surface p-0 text-fg backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <div className="flex flex-col gap-2">
            <h2 id="end-process-title" className="text-sm font-semibold">
              {t.endDialog.title(target.name)}
            </h2>
            <dl className="grid grid-cols-[5rem_1fr] gap-y-0.5">
              <dt className="text-muted">{t.endDialog.process}</dt>
              <dd className="font-mono text-[12px] break-all">{target.name}</dd>
              <dt className="text-muted">{t.endDialog.pid}</dt>
              <dd className="font-mono text-[12px]">{target.pid}</dd>
            </dl>
            <p className="text-muted">{t.endDialog.warning}</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-danger/40 px-3 py-2 text-danger">
            {describeError(error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="h-8 rounded-md border border-line px-3 text-muted hover:text-fg disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="h-8 rounded-md bg-danger/90 px-3 font-medium text-white hover:bg-danger disabled:opacity-60"
          >
            {busy ? t.endDialog.ending : t.endDialog.confirm}
          </button>
        </div>
      </div>
    </dialog>
  );
}
