import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../lib/api";
import type { Favorite } from "../types/favorites";

/** Favorite ports from SQLite. Every mutation returns the full list from the backend. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (request: () => Promise<Favorite[]>) => {
    try {
      setFavorites(await request());
      setError(null);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }, []);

  useEffect(() => {
    void run(api.listFavorites);
  }, [run]);

  const ports = useMemo(() => new Set(favorites.map((f) => f.port)), [favorites]);

  const add = useCallback((port: number) => run(() => api.addFavorite(port)), [run]);
  const remove = useCallback((port: number) => run(() => api.removeFavorite(port)), [run]);
  const toggle = useCallback(
    (port: number) => (ports.has(port) ? remove(port) : add(port)),
    [ports, add, remove],
  );

  return { favorites, ports, error, add, remove, toggle, clearError: () => setError(null) };
}

export type FavoritesState = ReturnType<typeof useFavorites>;
