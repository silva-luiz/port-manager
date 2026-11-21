import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, toAppError } from "../lib/api";
import type { AppError } from "../types/error";
import type { Locale } from "../types/settings";
import { describeError } from "./describeError";
import { en, type Messages } from "./en";
import { ptBR } from "./ptBR";

const MESSAGES: Record<Locale, Messages> = { en, "pt-BR": ptBR };

/** Language names are always shown in their own language. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", "pt-BR": "Português (Brasil)" };
export const LOCALES = Object.keys(MESSAGES) as Locale[];

interface I18nValue {
  locale: Locale;
  t: Messages;
  /** Persists the choice; resolves to an error if saving failed. */
  setLocale: (locale: Locale) => Promise<AppError | null>;
  formatTime: (ms: number) => string;
  formatNumber: (n: number) => string;
  describeError: (error: AppError) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Loads the saved language before rendering so the UI never flashes in the
 * wrong language. Falls back to English if settings can't be read.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setLocaleState(s.language))
      .catch(() => setLocaleState("en"));
  }, []);

  useEffect(() => {
    if (locale) document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      const previous = locale;
      setLocaleState(next);
      try {
        const saved = await api.setLanguage(next);
        setLocaleState(saved.language);
        return null;
      } catch (e) {
        setLocaleState(previous);
        return toAppError(e);
      }
    },
    [locale],
  );

  const value = useMemo<I18nValue | null>(() => {
    if (!locale) return null;
    const t = MESSAGES[locale];
    return {
      locale,
      t,
      setLocale,
      formatTime: (ms) => new Date(ms).toLocaleTimeString(locale),
      formatNumber: (n) => n.toLocaleString(locale),
      describeError: (error) => describeError(t, error),
    };
  }, [locale, setLocale]);

  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
