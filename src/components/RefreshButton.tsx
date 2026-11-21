import { RefreshCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

interface RefreshButtonProps {
  onClick: () => void;
  busy: boolean;
  label?: string;
}

export function RefreshButton({ onClick, busy, label }: RefreshButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-fg disabled:opacity-50"
    >
      <RefreshCw size={13} className={busy ? "animate-spin" : undefined} aria-hidden />
      {label ?? t.common.refresh}
    </button>
  );
}
