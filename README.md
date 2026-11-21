# Port Manager

A lightweight desktop utility for developers to see which local TCP ports are in use, which
processes own them, and to stop those processes when needed.

Built with Tauri 2 (Rust) and React + TypeScript. The initial target is Windows 10/11.

## Status

Early development. What works today:

- Dashboard with active ports, listening ports, established connections, process count and
  last refresh time.
- Ports table listing every IPv4/IPv6 TCP socket with its owning process: search, filters by
  process, port and state, sortable columns and a manual refresh button.
- Process details panel (name, PID, executable path when Windows allows it, connection info).
- Ending a process after a confirmation dialog. Critical Windows processes are refused, and
  permission errors are explained rather than elevated.
- Favorite ports, saved locally in SQLite: star a port from the table or details panel, or
  add one by number on the Favorites page, which shows whether each one is in use and by
  which process.
- Backend health check.

Data is stored in `%APPDATA%\com.portmanager.app\port-manager.db`. Deleting that file resets
the favorites.

## Prerequisites (Windows)

| Tool | Version used | Notes |
| --- | --- | --- |
| Rust (MSVC toolchain) | 1.100 stable | Install via [rustup](https://rustup.rs) or `winget install Rustlang.Rustup` |
| Microsoft C++ Build Tools | VS 2019/2022 | "Desktop development with C++" workload |
| WebView2 Runtime | any | Preinstalled on Windows 11 |
| Node.js | 22.x | npm 10.x |

See the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/) for details.

## Install

```bash
npm install
```

## Run in development

```bash
npm run tauri dev
```

The first run compiles all Rust dependencies and can take a few minutes. Afterwards the
window opens on the dashboard; open **Ports** in the left rail to see the full table.

## Build a release bundle

```bash
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/`.

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the application is structured.
- [DEVELOPMENT.md](DEVELOPMENT.md) — commands, checks and conventions.
