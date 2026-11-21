import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, vi } from "vitest";
import { I18nProvider } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { SettingsProvider } from "../settings/SettingsProvider";
import type { Locale, Settings } from "../types/settings";

/**
 * Renders `ui` inside the real Settings and I18n providers. The test file must
 * `vi.mock` the `lib/api` module with at least `api.getSettings`; settings are
 * served from that mock.
 */
export async function renderWithProviders(ui: ReactElement, locale: Locale = "en"): Promise<RenderResult> {
  const settings: Settings = {
    language: locale,
    autoRefreshSeconds: 0,
    autoRefreshOptions: [0],
    favoriteAlerts: false,
    closeToTray: false,
  };
  vi.mocked(api.getSettings).mockResolvedValue(settings);
  const result = render(
    <SettingsProvider>
      <I18nProvider>{ui}</I18nProvider>
    </SettingsProvider>,
  );
  // SettingsProvider renders nothing until settings load.
  await vi.waitFor(() => expect(result.container.firstChild).not.toBeNull());
  return result;
}

/** jsdom has no <dialog> modal support; emulate the parts the app uses. */
export function installDialogPolyfill() {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
