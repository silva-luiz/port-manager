# Development

## Commands

Run from the project root unless noted.

| Command | Purpose |
| --- | --- |
| `npm install` | Install frontend dependencies |
| `npm run tauri dev` | Run the desktop app with hot reload (frontend) and auto-rebuild (Rust) |
| `npm run dev` | Frontend only in a browser at http://localhost:1420 (IPC calls will fail; useful for layout work) |
| `npm run build` | Type-check (`tsc`) and build the frontend into `dist/` |
| `npm test` | Run frontend unit tests (Vitest) |
| `npm run tauri build` | Build a release installer |
| `cargo test` *(in `src-tauri/`)* | Run Rust unit tests |
| `cargo clippy --all-targets -- -D warnings` *(in `src-tauri/`)* | Lint Rust code |
| `cargo fmt` *(in `src-tauri/`)* | Format Rust code |

Before considering a change done, run: `npm test`, `npm run build`, `cargo fmt --check`,
`cargo clippy --all-targets -- -D warnings` and `cargo test`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main`, every pull request and on demand:
`npm ci`, `npm test`, `npm run build`, then `cargo fmt --check`, `cargo clippy --all-targets
-- -D warnings` and `cargo test` on `windows-latest`. The frontend is built first because the
Tauri crate embeds `dist/` at compile time.

## Releasing

1. Bump `version` in `package.json` (the app reads it) and `src-tauri/Cargo.toml`.
2. Move the `Unreleased` entries in `CHANGELOG.md` under the new version and date.
3. Push a tag `vX.Y.Z`, or run the **Release** workflow manually. It builds the installers and
   attaches them to a **draft** GitHub release; review it and click *Publish* on GitHub.

## Adding a backend command

1. Implement the logic in the appropriate domain module (not in `commands/`).
2. Add a thin `#[tauri::command]` in `src-tauri/src/commands/<area>.rs` that validates input
   and returns `Result<T, AppError>`.
3. Register it in `tauri::generate_handler![...]` in `src-tauri/src/lib.rs`, add its name to
   `COMMANDS` in `src-tauri/build.rs`, and grant `allow-<name-with-dashes>` in
   `src-tauri/capabilities/default.json`. Until it is granted, calls are denied.
4. Add the TypeScript mirror type under `src/types/` and a wrapper in `src/lib/api.ts`.
5. Add Rust unit tests for the logic and for the serialized shape when it matters.

## Changing the app icon

Edit `app-icon.svg` (or replace it with a 1024×1024 PNG) and run
`npm run tauri icon app-icon.svg`. Delete the generated `android/` and `ios/` folders; this is
a desktop-only app.

## Changing the database schema

Append a new SQL string to `MIGRATIONS` in `src-tauri/src/storage.rs`. Never edit or reorder
existing entries: installed copies have already applied them. Use `Database::open_in_memory()`
in tests.

## Adding or changing UI text

1. Add the key to `src/i18n/en.ts`. Use a function for anything with variables.
2. Add the same key to `src/i18n/ptBR.ts`; TypeScript fails the build until you do.
3. Read it with `const { t } = useI18n()`. Never hard-code user-visible strings in components.
4. For a new backend error, add a variant to `AppError` (Rust) carrying data, mirror it in
   `src/types/error.ts` and `KNOWN_KINDS` in `src/lib/api.ts`, and add a case to
   `describeError` plus a message in both dictionaries.

## Conventions

### Rust

- Edition 2024, formatted with `rustfmt`, clean under `clippy -D warnings`.
- No `unwrap()`/`expect()` on OS results outside tests; map failures to an `AppError` variant.
- Platform-specific code lives in per-OS files gated by `#[cfg(target_os = "...")]`.
- IPC structs: `#[derive(Serialize)]` + `#[serde(rename_all = "camelCase")]`.

### TypeScript / React

- `strict` TypeScript; no `any`.
- Components are small and presentational; data fetching lives in hooks under `src/hooks/`.
- Feature screens live in `src/features/<feature>/`; shared UI in `src/components/`.
- Styling uses Tailwind utilities with the design tokens defined in `src/index.css`
  (`bg-surface`, `border-line`, `text-muted`, `text-accent`, `bg-ok`/`bg-warn`/`bg-danger`).
  Use `font-mono` only for values that benefit from alignment (ports, PIDs, addresses).
- Icons come from `lucide-react`.
- Pure logic (filtering, sorting, joins, formatting) lives in plain `.ts` modules with a
  sibling `*.test.ts`. Shared test data builders are in `src/test/fixtures.ts`.
- Component tests (`*.test.tsx`) start with `// @vitest-environment jsdom`, mock the
  `lib/api` module, and render through `renderWithProviders` (`src/test/render.tsx`), which
  uses the real Settings and I18n providers. Query by role and accessible name, as a user
  would; use `findBy*` for anything that appears after an effect.
- Never re-derive a rule the backend already computes (e.g. use `entry.live`, not a
  list of states).

### Dependencies

Add a dependency only when it removes meaningful complexity, and note why in the pull request
or commit message.
