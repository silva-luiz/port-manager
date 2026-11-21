import { RefreshCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

interface RefreshButtonProps {
  onClick: () => void;
  busy: boolean;
  label?: string;
  /** Shown in the tooltip, e.g. "F5". */
  shortcut?: string;
}

export function RefreshButton({ onClick, busy, label, shortcut }: RefreshButtonProps) {
  const { t } = useI18n();
  const text = label ?? t.common.refresh;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={shortcut ? `${text} (${shortcut})` : undefined}
      className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-fg disabled:opacity-50"
    >
      <RefreshCw size={13} className={busy ? "animate-spin" : undefined} aria-hidden />
      {text}
    </button>
  );
}
