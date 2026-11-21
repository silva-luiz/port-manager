import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { api, toAppError } from "../../lib/api";
import type { AppError } from "../../types/error";

/** Opens Explorer with the executable of `pid` selected. */
export function RevealButton({ pid }: { pid: number }) {
  const { t, describeError } = useI18n();
  const [error, setError] = useState<AppError | null>(null);

  const reveal = async () => {
    setError(null);
    try {
      await api.revealExecutable(pid);
    } catch (e) {
      setError(toAppError(e));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void reveal()}
        aria-label={t.details.openFolder}
        title={t.details.openFolder}
        className="ml-1 inline-grid size-5 shrink-0 place-items-center rounded align-middle text-muted hover:bg-raised hover:text-fg"
      >
        <FolderOpen size={12} aria-hidden />
      </button>
      {error && (
        <span role="alert" className="block font-sans text-xs text-warn">
          {describeError(error)}
        </span>
      )}
    </>
  );
}
