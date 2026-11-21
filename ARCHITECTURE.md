# Architecture

Port Manager is a Tauri 2 application: a Rust backend that owns every operating-system
interaction, and a React + TypeScript frontend rendered in the system WebView.

```
┌──────────────────────────── WebView (React) ────────────────────────────┐
│ components / features  ──▶  hooks  ──▶  src/lib/api.ts  (typed invoke)  │
└───────────────────────────────────────────────┬─────────────────────────┘
                                                │ Tauri IPC (JSON)
┌──────────────────────────── Rust backend ─────▼─────────────────────────┐
│ commands/*  (thin, validated entry points)  ──▶  domain modules  ──▶ OS │
└─────────────────────────────────────────────────────────────────────────┘
```

## Current layout

```
port-manager/
├── src/                              # Frontend
│   ├── main.tsx, App.tsx             # Entry point; shell + view switching
│   ├── i18n/                         # en.ts (defines Messages), ptBR.ts,
│   │                                 # I18nProvider, describeError
│   ├── index.css                     # Tailwind import + design tokens (@theme)
│   ├── lib/
│   │   ├── api.ts                    # Only module that calls `invoke`
│   │   └── labels.ts                 # Untranslated protocol names
│   ├── types/                        # TS mirrors of Rust IPC structs
│   ├── hooks/
│   │   ├── useHealthCheck.ts
│   │   ├── usePortSnapshot.ts        # One snapshot shared by all views
│   │   ├── useFavorites.ts
│   │   └── useProcessDetails.ts
│   ├── components/                   # Shared UI: layout/, health/, RefreshButton, Notice,
│   │                                 # FavoriteButton
│   └── features/
│       ├── dashboard/                # DashboardPage, SummaryStrip
│       ├── favorites/                # FavoritesPage, favoriteUsage.ts (pure)
│       ├── ports/                    # PortsPage, PortsToolbar, PortsTable, StateBadge,
│       │                             # portQuery.ts (pure filter/sort logic)
│       ├── process/                  # DetailsPanel, EndProcessDialog
│       └── settings/                 # SettingsPage (language)
└── src-tauri/                        # Backend
    ├── tauri.conf.json               # Window, CSP, bundle config
    ├── capabilities/default.json     # Permissions granted to the main window
    └── src/
        ├── lib.rs                    # Builder + command registration
        ├── error.rs                  # AppError, serialized as { kind, message }
        ├── clock.rs                  # Wall-clock timestamps
        ├── network/
        │   ├── mod.rs                # Protocol, SocketState, NetSocket, OS dispatch
        │   └── windows.rs            # GetExtended{Tcp,Udp}Table (IPv4 + IPv6)
        ├── process/
        │   ├── mod.rs                # Names, details, PID validation, OS dispatch
        │   ├── windows.rs            # ToolHelp snapshot, executable path, open_process
        │   └── unsupported.rs        # Stub for other OSes
        ├── termination/
        │   ├── mod.rs                # Validation + name re-check before ending
        │   └── windows.rs            # Protected list, IsProcessCritical, TerminateProcess
        ├── ports.rs                  # Joins connections + names; computes summary
        ├── storage.rs                # SQLite connection + migrations
        ├── favorites.rs              # Favorite ports CRUD
        ├── settings.rs               # Typed settings (language) over a key/value table
        └── commands/
            ├── health.rs             # health_check
            ├── favorites.rs          # list/add/remove_favorite
            ├── settings.rs           # get_settings, set_language
            ├── ports.rs              # list_ports
            └── process.rs            # process_details, terminate_process
```

## Port discovery flow

1. `list_ports` moves the scan onto a blocking thread so the UI never freezes.
2. `network::sockets()` reads the IPv4 and IPv6 TCP and UDP tables with their owning PIDs
   (`GetExtendedTcpTable` / `GetExtendedUdpTable`, the same source `netstat -ano` uses). UDP
   has no connection state, so UDP sockets get `SocketState::Bound`, which counts as live. PID 0 becomes `None`, and an
   all-zero peer becomes "no remote address".
3. `process::process_names()` takes one ToolHelp snapshot of PID → executable name. This works
   for protected system processes without elevation. If it fails, ports are still returned
   with `processLookupError` set.
   Measured on a typical machine (38 owning processes, release build): a full scan takes about
   14 ms, of which reading command lines is about 0.5 ms, so no caching is used.
4. `ports::snapshot()` joins the two and computes the dashboard summary, so the numbers are
   defined in one place:
   - **Active ports**: distinct local ports with a live socket. Liveness is defined once,
     in `SocketState::is_live()` (everything except TIME_WAIT/CLOSED), and sent to the UI as
     `PortEntry.live`; the Favorites view uses that flag instead of its own rule.
   - **Listening**: distinct local ports in LISTEN (IPv4 and IPv6 counted once).
   - **Established**: ESTABLISHED sockets.
   - **Processes**: distinct owning PIDs.
5. The frontend filters and sorts client-side (`features/ports/portQuery.ts`). Non-live
   sockets are hidden by default unless a specific state is chosen.
6. Optional automatic refresh re-runs the scan on an interval while the page is visible
   (`document.visibilityState`), never overlapping an in-flight scan, and without the busy
   indicator. Responses from superseded scans are discarded.

## Frontend ↔ backend contract

- Every Tauri command is wrapped once in `src/lib/api.ts`. Components and hooks never call
  `invoke` directly.
- Rust structs use `#[serde(rename_all = "camelCase")]`; each has a hand-written TypeScript
  mirror in `src/types/` with a comment pointing back to the Rust source.
- Commands return `Result<T, AppError>`. `AppError` is structured data, not text:
  `{ "kind": "processNameMismatch", "pid": 42, "expected": "node.exe", "actual": "hugo.exe" }`.
  The frontend normalizes anything thrown with `toAppError()` and renders it with
  `describeError()` in the current language. `detail` fields (OS/SQLite error text) are
  shown verbatim inside the translated sentence. Rust's `Display` for `AppError` is English
  and only used for logs and tests. `errorMessage()` in `api.ts` normalizes any
  thrown value for display.

## Security posture

- Granted permissions: `core:default`, three notification commands (`is-permission-granted`,
  `request-permission`, `notify`) rather than the plugin's broader default set, and each app
  command individually (`allow-list-ports`, …). App commands are declared in `build.rs`
  (`AppManifest::commands`), so a command that is not granted in
  `capabilities/default.json` is denied, and an unknown permission name fails the build.
  `tauri-plugin-opener` is used only from Rust (`reveal_executable(pid)` resolves the path
  itself), so the webview has no opener permission and cannot open arbitrary paths. No shell
  or filesystem plugins.
- No command accepts or executes shell input from the frontend.
- A strict Content Security Policy is set in `tauri.conf.json`: scripts and styles only from the
  app itself, IPC connections only, no inline styles. `devCsp` adds `'unsafe-inline'` for
  styles because Vite injects `<style>` tags during development; the production build has none.
- The app never requests elevation. Operations that fail for lack of privileges will report
  that to the user instead.

## Process details and termination

- `process_details(pid)` returns the name (ToolHelp snapshot) and, when Windows allows opening
  the process with `PROCESS_QUERY_LIMITED_INFORMATION`, its executable path and command line
  (`NtQueryInformationProcess` / `ProcessCommandLineInformation`). A refused path comes back
  as `pathError` instead of failing the call; a vanished process is `processNotFound`.
- It also returns the parent process and all descendants. Windows keeps a process's parent
  PID after the parent exits and may reuse that PID, so `process::descendants` only accepts a
  parent/child link when the parent's creation time (`GetProcessTimes`) is not later than the
  child's. Processes whose creation time can't be read are left out rather than guessed.
- `list_ports` includes each owning process's command line (one lookup per PID), so the table
  can tell several `node.exe` apart and search can match script names.
- `terminate_process(pid, expectedName, includeChildren)` is only called from the
  confirmation dialog (`EndProcessDialog`). Ending children is opt-in; the dialog lists them.
  The backend then:
  1. rejects PID 0 and the app's own PID;
  2. re-reads the process name and refuses if it no longer matches `expectedName`
     (protects against PID reuse between refresh and click);
  3. refuses a fixed list of core Windows processes and anything `IsProcessCritical`
     reports as critical (`protectedProcess`);
  4. calls `TerminateProcess` and waits up to 3 s for exit. Access denied becomes
     `permissionDenied` with an explanation; the app never elevates.
  5. with `includeChildren`: vets the main process first (protection + permission), computes
     the full descendant set, ends the main process, then the descendants parents-first, so a
     supervisor (npm, watcher, auto-reloader) can't respawn them. A child that can't be ended
     is reported in `children[].error`; it never aborts the operation.
- All commands touching the OS run via `spawn_blocking` so the UI thread never waits on them.

## Local storage

- SQLite via `rusqlite` with the `bundled` feature (SQLite is compiled in; nothing to install).
- The database is `%APPDATA%\com.portmanager.app\port-manager.db`, opened in Tauri's `setup`
  hook and shared as managed state (`storage::Database`, one connection behind a mutex).
- Migrations are the `MIGRATIONS` list in `storage.rs`, tracked with `PRAGMA user_version`.
  Each runs in its own transaction. Append new migrations; never edit existing ones.
- `settings` table: `key`/`value` text pairs behind the typed API in `settings.rs`
  (`language`, `auto_refresh_seconds`, `favorite_alerts`, `close_to_tray`). Invalid stored values fall back to defaults; invalid
  new values are rejected with `invalidSetting`. The backend also returns the allowed refresh
  intervals so the UI doesn't hard-code them.
- On the frontend, `SettingsProvider` loads settings once before the first render, applies
  changes optimistically and reverts them if saving fails. `I18nProvider` derives the
  language from it; `usePortSnapshot` takes the refresh interval.
- `favorites` table: `port` (primary key, CHECK 1–65535) and `created_at_ms`. Add/remove are
  idempotent and return the full updated list so the UI has a single source of truth.
- The Favorites view joins favorites with the current port snapshot on the frontend
  (`favoriteUsage.ts`); "in use" uses the same rule as the dashboard (any socket that is not
  TIME_WAIT/CLOSED).

## Favorite port alerts

- `watcher.rs` runs one background thread started in `setup`. Every 3 s, and only while the
  `favorite_alerts` setting is on and there are favorites, it reads the TCP table (no process
  names), computes in-use status per favorite port with the same `is_live` rule, and compares
  it with the previous tick. Process names are looked up only for ports that changed.
- The first tick after enabling records a baseline, so turning alerts on never fires for the
  current state; newly added favorites are also baseline-only on their first tick.
- Changes are emitted as the `favorite-port-changed` event. The frontend
  (`useFavoriteAlerts`) formats them in the current language (`favoriteAlerts.ts`), shows a
  Windows notification via `tauri-plugin-notification`, and quietly refreshes the views.
- It runs in Rust rather than on a frontend timer because the frontend refresh pauses while
  the window is hidden, which is exactly when alerts matter most.

## Single instance and tray

- `tauri-plugin-single-instance` is registered first: a second launch only calls
  `show_main_window`, so there is one watcher thread and one saved window state.
- `tray.rs` keeps a tray icon in sync with the `close_to_tray` setting (created, relabelled on
  language change, or removed). While it is on, `CloseRequested` on the main window is
  prevented and the window is hidden; the tray's left click shows it, and its menu has Show
  and Quit. The tray menu is native, so its two labels are the only UI text translated in
  Rust.

## Logging

`tauri-plugin-log` writes to a rotating file in the app log folder (1 MB, last 3 kept) and, in
debug builds, to the terminal. Only Rust logs; the frontend has no log permission. Logged:
start-up, every ended process (an audit trail), command errors (`run_blocking`), database
errors (`Database::with`), skipped watcher ticks and detected favorite changes.

## Window state

`tauri-plugin-window-state` (Rust side only, no frontend permission) saves size, position and
maximized state on close and restores them at launch. It ignores a saved position whose
monitor is no longer connected.

## Internationalization

- Supported UI languages: English (`en`, default) and Brazilian Portuguese (`pt-BR`).
- `src/i18n/en.ts` defines the `Messages` shape; `ptBR.ts` is typed as `Messages`, so a
  missing or mistyped key fails the build. Messages with variables are functions
  (`ended: (name, pid) => ...`) so word order can differ per language.
- `I18nProvider` loads the saved language before the first render (no flash of the wrong
  language), sets `<html lang>`, and exposes `t`, `formatTime`, `formatNumber` (via
  `Intl` with the active locale) and `describeError`.
- State that ends up as user-visible text (errors, the "process ended" notice) is stored as
  data and formatted at render time, so switching language updates it immediately.
- The choice is persisted by `set_language` in the `settings` table. The backend only
  accepts `"en"` or `"pt-BR"` (serde enum); unknown stored values fall back to English.
- Not translated: protocol names (TCP/TCPv6), process names, addresses and raw OS details.

## Platform support

OS-specific code lives in `<module>/windows.rs`, selected with `#[cfg(windows)]` behind one
shared function in `<module>/mod.rs`. Other platforms currently get `AppError::Unsupported`;
Linux support means adding `linux.rs` next to each `windows.rs`.

## Planned backend modules

| Module | Responsibility |
| --- | --- |
| `storage/` | SQLite persistence for favorites and settings. |
| `commands/` | One file per feature area; validates input, calls the modules above, maps errors to `AppError`. |

Connections are never assumed to have an owning process; missing PIDs, vanished processes
and inaccessible executable paths are modelled as optional fields or specific error kinds.
