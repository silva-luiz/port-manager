import { Gauge, Network, Star, type LucideIcon } from "lucide-react";

export type View = "dashboard" | "ports" | "favorites";

const NAV_ITEMS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "dashboard", label: "Dashboard", icon: Gauge },
  { view: "ports", label: "Ports", icon: Network },
  { view: "favorites", label: "Favorites", icon: Star },
];

interface SidebarProps {
  active: View;
  onNavigate: (view: View) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Main" className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
      {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          type="button"
          onClick={() => onNavigate(view)}
          aria-current={view === active ? "page" : undefined}
          title={label}
          className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-raised hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-accent"
        >
          <Icon size={18} strokeWidth={1.75} aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </nav>
  );
}
