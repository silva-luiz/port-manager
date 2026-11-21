import { useState, type ReactNode } from "react";
import { Notice } from "../../components/Notice";
import { LOCALES, LOCALE_NAMES, useI18n } from "../../i18n/I18nProvider";
import { useSettings } from "../../settings/SettingsProvider";
import type { AppError } from "../../types/error";

export function SettingsPage() {
  const { t, locale, setLocale, describeError } = useI18n();
  const { settings, setAutoRefresh, setCloseToTray } = useSettings();
  const [error, setError] = useState<AppError | null>(null);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Group title={t.settings.languageTitle} hint={t.settings.languageHint}>
        <div className="flex flex-col gap-2">
          {LOCALES.map((option) => (
            <label key={option} lang={option} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="language"
                value={option}
                checked={option === locale}
                onChange={async () => setError(await setLocale(option))}
                className="accent-accent"
              />
              {LOCALE_NAMES[option]}
            </label>
          ))}
        </div>
      </Group>

      <Group title={t.settings.autoRefreshTitle} hint={t.settings.autoRefreshHint}>
        <select
          aria-label={t.settings.autoRefreshTitle}
          value={settings.autoRefreshSeconds}
          onChange={async (e) => setError(await setAutoRefresh(Number(e.target.value)))}
          className="h-8 rounded-md border border-line bg-base px-2.5 text-[13px] text-fg focus:border-accent/60 focus:outline-none"
        >
          {settings.autoRefreshOptions.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds === 0 ? t.settings.autoRefreshOff : t.settings.autoRefreshEvery(seconds)}
            </option>
          ))}
        </select>
      </Group>

      <Group title={t.settings.windowTitle} hint={t.settings.closeToTrayHint}>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={settings.closeToTray}
            onChange={async (e) => setError(await setCloseToTray(e.target.checked))}
            className="accent-accent"
          />
          {t.settings.closeToTray}
        </label>
      </Group>

      {error && <Notice onDismiss={() => setError(null)}>{t.settings.saveError(describeError(error))}</Notice>}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-line bg-surface px-4 py-3">
      <legend className="px-1 font-medium">{title}</legend>
      <p className="mb-3 text-muted">{hint}</p>
      {children}
    </fieldset>
  );
}
