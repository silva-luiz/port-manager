# Port Manager

A lightweight desktop utility for developers to see which local TCP ports are in use, which
processes own them, and to stop those processes when needed.

Built with Tauri 2 (Rust) and React + TypeScript. Runs on Windows 10/11 and Linux. To build on
Linux, install the [Tauri Linux prerequisites](https://tauri.app/start/prerequisites/#linux)
(WebKitGTK 4.1, libayatana-appindicator3 and friends); the CI workflow lists the exact Ubuntu
packages.

## Status

Early development. What works today:

- Dashboard with active ports, listening ports, established connections, process count, last
  refresh time and the listening ports grouped by process.
- Ports table listing every IPv4/IPv6 TCP and UDP socket with its owning process and command line
  (so several `node.exe` can be told apart): search, filters by process, port and state,
  a protocol filter, sortable columns, finished connections (TIME_WAIT) hidden by default, and manual or optional
  automatic refresh.
- Process details panel: name, PID, executable path and command line when Windows allows it,
  the parent process, child processes and connection info.
- Ending a process after a confirmation dialog, optionally together with its child processes.
  Critical Windows processes are refused, and permission errors are explained rather than
  elevated.
- Favorite ports, saved locally in SQLite: star a port from the table or details panel, or
  add one by number on the Favorites page, which shows whether each one is in use and by
  which process. Optionally, get a Windows notification when a favorite port becomes busy or
  free, even while the app is minimized.
- One-click copy of PID, port, addresses, executable path and command line, and "Open folder"
  to show a process's executable in Explorer.
- **Settings** (gear icon at the bottom of the left rail): English or Brazilian Portuguese
  interface, automatic refresh (off, or every 2–30 seconds), and keeping the app running in the
  notification area when the window is closed (so favorite alerts keep working). Choices are
  remembered. Only one copy of the app runs at a time; opening it again shows the existing
  window.
- Keyboard shortcuts: `Ctrl+F` search ports, `F5`/`Ctrl+R` refresh, `Esc` close the details
  panel.
- Backend health check (under Settings).

Data is stored in `%APPDATA%\com.portmanager.app\port-manager.db`. Deleting that file resets
the favorites and settings. The window size, position and maximized state are remembered in
`.window-state.json` in the same folder.

Logs (app start, ended processes, errors, favorite port changes) are written to
`%LOCALAPPDATA%\com.portmanager.app\logs`, rotated at 1 MB with the last 3 files kept.

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
