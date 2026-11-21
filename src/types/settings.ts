/** Mirrors `Language` in src-tauri/src/settings.rs (BCP 47 tags). */
export type Locale = "en" | "pt-BR";

/** Mirrors `Settings` in src-tauri/src/settings.rs. */
export interface Settings {
  language: Locale;
  /** 0 means automatic refresh is off. */
  autoRefreshSeconds: number;
  /** Allowed values for `autoRefreshSeconds`, provided by the backend. */
  autoRefreshOptions: number[];
}
