import type { Messages } from "../../i18n/en";
import type { FavoritePortChange } from "../../types/favorites";

/** Notification text for a favorite port that became busy or free. */
export function favoriteChangeMessage(t: Messages, change: FavoritePortChange): { title: string; body: string } {
  const n = t.notifications;
  if (!change.inUse) return { title: n.freeTitle(change.port), body: n.freeBody };
  return {
    title: n.busyTitle(change.port),
    body:
      change.processName && change.pid !== null ? n.busyBody(change.processName, change.pid) : n.busyBodyUnknown,
  };
}
