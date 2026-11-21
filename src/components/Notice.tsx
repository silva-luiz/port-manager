import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "danger" | "warn" | "ok";

const STYLES: Record<Tone, string> = {
  danger: "border-danger/40 text-danger",
  warn: "border-warn/40 text-warn",
  ok: "border-ok/40 text-ok",
};

interface NoticeProps {
  tone?: Tone;
  children: ReactNode;
  onDismiss?: () => void;
}

export function Notice({ tone = "danger", children, onDismiss }: NoticeProps) {
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={tone === "ok" ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-md border bg-surface px-3 py-2 ${STYLES[tone]}`}
    >
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1">{children}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-muted hover:text-fg" aria-label="Dismiss">
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
