import { Star } from "lucide-react";

interface FavoriteButtonProps {
  port: number;
  active: boolean;
  onToggle: (port: number) => void;
  className?: string;
}

export function FavoriteButton({ port, active, onToggle, className = "" }: FavoriteButtonProps) {
  const label = active ? `Remove port ${port} from favorites` : `Add port ${port} to favorites`;
  return (
    <button
      type="button"
      onClick={() => onToggle(port)}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid size-6 place-items-center rounded hover:bg-raised ${active ? "text-warn" : "text-muted hover:text-fg"} ${className}`}
    >
      <Star size={14} fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
