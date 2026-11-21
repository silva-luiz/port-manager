/** Mirrors `Favorite` in src-tauri/src/favorites.rs. */
export interface Favorite {
  port: number;
  createdAtMs: number;
}

/** Mirrors `FavoritePortChange` in src-tauri/src/watcher.rs (event payload). */
export interface FavoritePortChange {
  port: number;
  inUse: boolean;
  pid: number | null;
  processName: string | null;
}
