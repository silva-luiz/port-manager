export type Shortcut = "search" | "refresh" | "close";

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Maps a key press to an app shortcut. F5 and Ctrl+R are taken over so they
 * refresh the port list instead of reloading the whole page.
 */
export function shortcutFor(e: KeyLike): Shortcut | null {
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.altKey) return null;
  if (ctrl && !e.shiftKey && e.key.toLowerCase() === "f") return "search";
  if (e.key === "F5" || (ctrl && e.key.toLowerCase() === "r")) return "refresh";
  if (!ctrl && !e.shiftKey && e.key === "Escape") return "close";
  return null;
}

export const SEARCH_INPUT_ID = "ports-search";
