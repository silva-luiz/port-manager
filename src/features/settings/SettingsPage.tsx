import { useState } from "react";
import { Notice } from "../../components/Notice";
import { LOCALES, LOCALE_NAMES, useI18n } from "../../i18n/I18nProvider";
import type { AppError } from "../../types/error";
import type { Locale } from "../../types/settings";

export function SettingsPage() {
  const { t, locale, setLocale, describeError } = useI18n();
  const [error, setError] = useState<AppError | null>(null);

  const choose = async (next: Locale) => {
    if (next === locale) return;
    setError(await setLocale(next));
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <fieldset className="rounded-lg border border-line bg-surface px-4 py-3">
        <legend className="px-1 font-medium">{t.settings.languageTitle}</legend>
        <p className="mb-3 text-muted">{t.settings.languageHint}</p>
        <div className="flex flex-col gap-2">
          {LOCALES.map((option) => (
            <label key={option} lang={option} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="language"
                value={option}
                checked={option === locale}
                onChange={() => void choose(option)}
                className="accent-accent"
              />
              {LOCALE_NAMES[option]}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <Notice onDismiss={() => setError(null)}>{t.settings.saveError(describeError(error))}</Notice>
      )}
    </div>
  );
}
