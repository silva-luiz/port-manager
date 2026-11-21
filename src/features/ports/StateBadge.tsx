import { STATE_LABELS } from "../../lib/labels";
import type { TcpState } from "../../types/ports";

const TONE: Partial<Record<TcpState, string>> = {
  listen: "text-ok bg-ok/10",
  established: "text-accent bg-accent/10",
  closeWait: "text-warn bg-warn/10",
  finWait1: "text-warn bg-warn/10",
  finWait2: "text-warn bg-warn/10",
  lastAck: "text-warn bg-warn/10",
  closing: "text-warn bg-warn/10",
};

export function StateBadge({ state }: { state: TcpState }) {
  const tone = TONE[state] ?? "text-muted bg-raised";
  return (
    <span className={`inline-block rounded px-1.5 py-px text-xs font-medium ${tone}`}>
      {STATE_LABELS[state]}
    </span>
  );
}
