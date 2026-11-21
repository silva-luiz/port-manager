import { Gauge, Network, Settings, Star, type LucideIcon } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";

export type View = "dashboard" | "ports" | "favorites" | "settings";

const MAIN_ITEMS: { view: View; icon: LucideIcon }[] = [
  { view: "dashboard", icon: Gauge },
  { view: "ports", icon: Network },
  { view: "favorites", icon: Star },
];

interface SidebarProps {
  active: View;
  onNavigate: (view: View) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { t } = useI18n();

  const item = (view: View, Icon: LucideIcon) => (
    <button
      key={view}
      type="button"
      onClick={() => onNavigate(view)}
      aria-current={view === active ? "page" : undefined}
      title={t.nav[view]}
      className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-raised hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-accent"
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      <span className="sr-only">{t.nav[view]}</span>
    </button>
  );

  return (
    <nav aria-label={t.nav.label} className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
      {MAIN_ITEMS.map(({ view, icon }) => item(view, icon))}
      <div className="mt-auto">{item("settings", Settings)}</div>
    </nav>
  );
}
