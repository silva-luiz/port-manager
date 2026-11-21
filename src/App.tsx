import { useState } from "react";
import { BackendStatusBadge } from "./components/health/BackendStatusBadge";
import { Header } from "./components/layout/Header";
import { Sidebar, type View } from "./components/layout/Sidebar";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { PortsPage } from "./features/ports/PortsPage";
import { useFavorites } from "./hooks/useFavorites";
import { useHealthCheck } from "./hooks/useHealthCheck";
import { usePortSnapshot } from "./hooks/usePortSnapshot";

const TITLES: Record<View, string> = { dashboard: "Dashboard", ports: "Ports", favorites: "Favorites" };

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const health = useHealthCheck();
  // Shared across views so the dashboard, table and favorites always agree.
  const ports = usePortSnapshot();
  const favorites = useFavorites();

  return (
    <div className="flex h-full">
      <Sidebar active={view} onNavigate={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={TITLES[view]}>
          <BackendStatusBadge state={health.state} />
        </Header>
        <main className="min-h-0 flex-1 overflow-auto p-5">
          {view === "dashboard" && (
            <DashboardPage ports={ports} health={health.state} onCheckHealth={health.check} />
          )}
          {view === "ports" && <PortsPage ports={ports} favorites={favorites} />}
          {view === "favorites" && <FavoritesPage favorites={favorites} ports={ports} />}
        </main>
      </div>
    </div>
  );
}
