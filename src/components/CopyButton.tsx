import { Check, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

type Status = "idle" | "copied" | "failed";

const RESET_AFTER_MS = 1500;

/** Copies `value` to the clipboard and briefly confirms the result. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), RESET_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  const Icon = status === "copied" ? Check : status === "failed" ? X : Copy;
  const action = `${t.common.copy}: ${label}`;
  const text = status === "copied" ? t.common.copied : status === "failed" ? t.common.copyFailed : action;

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={action}
      title={text}
      className={`ml-1 inline-grid size-5 shrink-0 place-items-center rounded align-middle hover:bg-raised ${
        status === "copied" ? "text-ok" : status === "failed" ? "text-danger" : "text-muted hover:text-fg"
      }`}
    >
      <Icon size={12} aria-hidden />
      <span role="status" className="sr-only">
        {status === "idle" ? "" : text}
      </span>
    </button>
  );
}
