import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSettings } from "../settings/SettingsProvider";
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

/** Derives text and formatting from the saved language (see SettingsProvider). */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, setLanguage } = useSettings();
  const locale = settings.language;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(() => {
    const t = MESSAGES[locale];
    return {
      locale,
      t,
      setLocale: setLanguage,
      formatTime: (ms) => new Date(ms).toLocaleTimeString(locale),
      formatNumber: (n) => n.toLocaleString(locale),
      describeError: (error) => describeError(t, error),
    };
  }, [locale, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
