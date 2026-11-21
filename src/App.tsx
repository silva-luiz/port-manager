import { useState } from "react";
import { BackendStatusBadge } from "./components/health/BackendStatusBadge";
import { Header } from "./components/layout/Header";
import { Sidebar, type View } from "./components/layout/Sidebar";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { PortsPage } from "./features/ports/PortsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { useFavoriteAlerts } from "./hooks/useFavoriteAlerts";
import { useFavorites } from "./hooks/useFavorites";
import { useHealthCheck } from "./hooks/useHealthCheck";
import { useShortcuts } from "./hooks/useShortcuts";
import { usePortSnapshot } from "./hooks/usePortSnapshot";
import { useI18n } from "./i18n/I18nProvider";
import { SEARCH_INPUT_ID } from "./lib/shortcuts";
import { useSettings } from "./settings/SettingsProvider";

export default function App() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [view, setView] = useState<View>("dashboard");
  const health = useHealthCheck();
  // Shared across views so the dashboard, table and favorites always agree.
  const ports = usePortSnapshot(settings.autoRefreshSeconds);
  const favorites = useFavorites();
  // A favorite changed while alerts are on: bring the views up to date quietly.
  useFavoriteAlerts(() => void ports.refresh({ background: true }));
  useShortcuts({
    refresh: () => void ports.refresh(),
    search: () => {
      setView("ports");
      // Wait for the Ports view to render before focusing its search box.
      requestAnimationFrame(() => {
        const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      });
    },
  });

  return (
    <div className="flex h-full">
      <Sidebar active={view} onNavigate={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={t.nav[view]}>
          <BackendStatusBadge state={health.state} />
        </Header>
        <main className="min-h-0 flex-1 overflow-auto p-5">
          {view === "dashboard" && (
            <DashboardPage ports={ports} health={health.state} onCheckHealth={health.check} />
          )}
          {view === "ports" && <PortsPage ports={ports} favorites={favorites} />}
          {view === "favorites" && <FavoritesPage favorites={favorites} ports={ports} />}
          {view === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
