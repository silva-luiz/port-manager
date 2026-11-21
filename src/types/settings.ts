/** Mirrors `Language` in src-tauri/src/settings.rs (BCP 47 tags). */
export type Locale = "en" | "pt-BR";

/** Mirrors `Settings` in src-tauri/src/settings.rs. */
export interface Settings {
  language: Locale;
}
