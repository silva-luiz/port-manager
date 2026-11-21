import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, toAppError } from "../lib/api";
import type { AppError } from "../types/error";
import type { Locale, Settings } from "../types/settings";

/** Used when settings can't be loaded (e.g. the page is open in a plain browser). */
const FALLBACK: Settings = {
  language: "en",
  autoRefreshSeconds: 0,
  autoRefreshOptions: [0],
  favoriteAlerts: false,
  closeToTray: false,
};

interface SettingsValue {
  settings: Settings;
  /** Each setter applies the change immediately and resolves to an error if saving failed (the change is then reverted). */
  setLanguage: (language: Locale) => Promise<AppError | null>;
  setAutoRefresh: (seconds: number) => Promise<AppError | null>;
  setFavoriteAlerts: (enabled: boolean) => Promise<AppError | null>;
  setCloseToTray: (enabled: boolean) => Promise<AppError | null>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/** Loads settings before rendering children, so nothing renders with the wrong language. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  // Mirrors `settings` so a failed save can restore the value it replaced.
  const current = useRef<Settings | null>(null);
  const latestSave = useRef(0);

  useEffect(() => {
    current.current = settings;
  }, [settings]);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings(FALLBACK));
  }, []);

  const save = useCallback(async (optimistic: Partial<Settings>, request: () => Promise<Settings>) => {
    const id = ++latestSave.current;
    const previous = current.current;
    if (previous) setSettings({ ...previous, ...optimistic });
    try {
      const saved = await request();
      if (id === latestSave.current) setSettings(saved);
      return null;
    } catch (e) {
      if (id === latestSave.current && previous) setSettings(previous);
      return toAppError(e);
    }
  }, []);

  const value = useMemo<SettingsValue | null>(
    () =>
      settings && {
        settings,
        setLanguage: (language) => save({ language }, () => api.setLanguage(language)),
        setAutoRefresh: (seconds) => save({ autoRefreshSeconds: seconds }, () => api.setAutoRefresh(seconds)),
        setFavoriteAlerts: (enabled) => save({ favoriteAlerts: enabled }, () => api.setFavoriteAlerts(enabled)),
        setCloseToTray: (enabled) => save({ closeToTray: enabled }, () => api.setCloseToTray(enabled)),
      },
    [settings, save],
  );

  if (!value) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside <SettingsProvider>");
  return value;
}
