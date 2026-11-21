import { useEffect, useRef } from "react";
import { favoriteChangeMessage } from "../features/favorites/favoriteAlerts";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { showNotification } from "../lib/notifications";
import type { FavoritePortChange } from "../types/favorites";

/**
 * Shows a system notification for each favorite port change reported by the
 * backend watcher, in the current language, and calls `onChange` so views can
 * refresh. The backend only emits while alerts are enabled.
 */
export function useFavoriteAlerts(onChange: (change: FavoritePortChange) => void) {
  const { t } = useI18n();
  // Refs keep one subscription for the app's lifetime while using current values.
  const latest = useRef({ t, onChange });
  useEffect(() => {
    latest.current = { t, onChange };
  });

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    api
      .onFavoritePortChange((change) => {
        const { title, body } = favoriteChangeMessage(latest.current.t, change);
        showNotification(title, body);
        latest.current.onChange(change);
      })
      .then((stop) => (disposed ? stop() : (unlisten = stop)))
      .catch(() => {
        // Outside Tauri (plain browser) there is nothing to listen to.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
