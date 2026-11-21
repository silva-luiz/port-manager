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
        │   ├── mod.rs                # Protocol, TcpState, TcpConnection, OS dispatch
        │   └── windows.rs            # GetExtendedTcpTable (IPv4 + IPv6)
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
2. `network::tcp_connections()` reads the IPv4 and IPv6 TCP tables with their owning PIDs
   (`GetExtendedTcpTable`, the same source `netstat -ano` uses). PID 0 becomes `None`, and an
   all-zero peer becomes "no remote address".
3. `process::process_names()` takes one ToolHelp snapshot of PID → executable name. This works
   for protected system processes without elevation. If it fails, ports are still returned
   with `processLookupError` set.
4. `ports::snapshot()` joins the two and computes the dashboard summary, so the numbers are
   defined in one place:
   - **Active ports**: distinct local ports with a live socket. Liveness is defined once,
     in `TcpState::is_live()` (everything except TIME_WAIT/CLOSED), and sent to the UI as
     `PortEntry.live`; the Favorites view uses that flag instead of its own rule.
   - **Listening**: distinct local ports in LISTEN (IPv4 and IPv6 counted once).
   - **Established**: ESTABLISHED sockets.
   - **Processes**: distinct owning PIDs.
5. The frontend filters and sorts client-side (`features/ports/portQuery.ts`).

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

- Only `core:default` permissions are granted; no shell, filesystem or opener plugins.
- No command accepts or executes shell input from the frontend.
- A strict Content Security Policy is set in `tauri.conf.json` (self-hosted scripts only, IPC
  connections only).
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
  (currently only `language`).
- `favorites` table: `port` (primary key, CHECK 1–65535) and `created_at_ms`. Add/remove are
  idempotent and return the full updated list so the UI has a single source of truth.
- The Favorites view joins favorites with the current port snapshot on the frontend
  (`favoriteUsage.ts`); "in use" uses the same rule as the dashboard (any socket that is not
  TIME_WAIT/CLOSED).

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
