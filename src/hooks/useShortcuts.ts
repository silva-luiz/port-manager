import { useEffect, useRef } from "react";
import { shortcutFor, type Shortcut } from "../lib/shortcuts";

/**
 * Keyboard shortcuts for the calling component. Only shortcuts with a handler
 * are intercepted. Escape is left alone while a modal dialog is open, because
 * the dialog handles it (cancel).
 */
export function useShortcuts(handlers: Partial<Record<Shortcut, () => void>>) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcutFor(e);
      const handler = shortcut && latest.current[shortcut];
      if (!handler) return;
      if (shortcut === "close" && document.querySelector("dialog[open]")) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
