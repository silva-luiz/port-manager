import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const STORAGE_KEY = "detailsPanelWidth";
export const DEFAULT_PANEL_WIDTH = 320;
export const MIN_PANEL_WIDTH = 280;
const KEY_STEP = 16;

/** Widest the panel may get in a window this wide, leaving room for the table. */
export function maxPanelWidth(windowWidth: number): number {
  return Math.max(MIN_PANEL_WIDTH, Math.round(windowWidth * 0.7));
}

export function clampPanelWidth(width: number, windowWidth: number): number {
  if (!Number.isFinite(width)) return DEFAULT_PANEL_WIDTH;
  return Math.round(Math.min(Math.max(width, MIN_PANEL_WIDTH), maxPanelWidth(windowWidth)));
}

function readStored(): number {
  const raw = Number(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PANEL_WIDTH);
  return clampPanelWidth(raw, window.innerWidth);
}

/**
 * Width of a panel docked on the right, resized by dragging (or arrow keys on)
 * a handle on its left edge. The chosen width is remembered across sessions.
 */
export function usePanelWidth() {
  const [width, setWidth] = useState(readStored);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const commit = useCallback((next: number) => {
    const clamped = clampPanelWidth(next, window.innerWidth);
    setWidth(clamped);
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }, []);

  const handleProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { startX: e.clientX, startWidth: width };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag.current) return;
      // Docked on the right: moving the handle left widens the panel.
      const next = drag.current.startWidth + (drag.current.startX - e.clientX);
      setWidth(clampPanelWidth(next, window.innerWidth));
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (!drag.current) return;
      drag.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
      commit(width);
    },
    onLostPointerCapture: () => {
      if (drag.current) {
        drag.current = null;
        commit(width);
      }
    },
    onDoubleClick: () => commit(DEFAULT_PANEL_WIDTH),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "ArrowLeft") commit(width + KEY_STEP);
      else if (e.key === "ArrowRight") commit(width - KEY_STEP);
      else return;
      e.preventDefault();
    },
  };

  return { width, handleProps, min: MIN_PANEL_WIDTH, max: maxPanelWidth(window.innerWidth) };
}
