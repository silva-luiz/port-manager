import { Star } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

interface FavoriteButtonProps {
  port: number;
  active: boolean;
  onToggle: (port: number) => void;
}

export function FavoriteButton({ port, active, onToggle }: FavoriteButtonProps) {
  const { t } = useI18n();
  const label = active ? t.favorites.removeLabel(port) : t.favorites.addLabel(port);
  return (
    <button
      type="button"
      onClick={() => onToggle(port)}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid size-6 place-items-center rounded hover:bg-raised ${active ? "text-warn" : "text-muted hover:text-fg"}`}
    >
      <Star size={14} fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
