# Development

## Commands

Run from the project root unless noted.

| Command | Purpose |
| --- | --- |
| `npm install` | Install frontend dependencies |
| `npm run tauri dev` | Run the desktop app with hot reload (frontend) and auto-rebuild (Rust) |
| `npm run dev` | Frontend only in a browser at http://localhost:1420 (IPC calls will fail; useful for layout work) |
| `npm run build` | Type-check (`tsc`) and build the frontend into `dist/` |
| `npm run tauri build` | Build a release installer |
| `cargo test` *(in `src-tauri/`)* | Run Rust unit tests |
| `cargo clippy --all-targets -- -D warnings` *(in `src-tauri/`)* | Lint Rust code |
| `cargo fmt` *(in `src-tauri/`)* | Format Rust code |

Before considering a change done, run: `npm run build`, `cargo fmt --check`, `cargo clippy
--all-targets -- -D warnings` and `cargo test`.

## Adding a backend command

1. Implement the logic in the appropriate domain module (not in `commands/`).
2. Add a thin `#[tauri::command]` in `src-tauri/src/commands/<area>.rs` that validates input
   and returns `Result<T, AppError>`.
3. Register it in `tauri::generate_handler![...]` in `src-tauri/src/lib.rs`.
4. Add the TypeScript mirror type under `src/types/` and a wrapper in `src/lib/api.ts`.
5. Add Rust unit tests for the logic and for the serialized shape when it matters.

## Changing the database schema

Append a new SQL string to `MIGRATIONS` in `src-tauri/src/storage.rs`. Never edit or reorder
existing entries: installed copies have already applied them. Use `Database::open_in_memory()`
in tests.

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

### Dependencies

Add a dependency only when it removes meaningful complexity, and note why in the pull request
or commit message.
