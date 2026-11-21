# Changelog

All notable changes to Port Manager. Versions follow [Semantic Versioning](https://semver.org/).

## [0.2.0] - Unreleased

### Added
- Linux support: sockets, owners, process details and termination via `/proc` and `kill(2)`.
- UDP sockets (IPv4/IPv6) alongside TCP, with a protocol filter.
- "Open folder" to show a process's executable in the file manager.
- Brazilian Portuguese (pt-BR) interface, chosen under Settings.
- Command line of each process in the ports table (arguments next to the name, searchable)
  and in the details panel, plus the parent process and child processes.
- Optionally end a process together with its child processes.
- Copy buttons for PID, port, addresses, executable path and command line.
- Windows notifications when a favorite port becomes busy or free (opt-in, works while
  minimized).
- Optional automatic refresh (2–30 seconds).
- Option to keep running in the notification area when the window is closed.
- "Hide finished connections" filter (TIME_WAIT/CLOSED), on by default.
- Listening ports grouped by process on the dashboard.
- Own app icon.
- Keyboard shortcuts: `Ctrl+F` search, `F5`/`Ctrl+R` refresh, `Esc` close the details panel.
- Window size, position and maximized state are remembered.
- Rotating log file in `%LOCALAPPDATA%\com.portmanager.app\logs`.
- CI on GitHub Actions (Windows and Linux) and a release workflow that drafts releases with
  the installers.
- Component tests for the end-process dialog and the ports toolbar.

### Changed
- Only one instance runs at a time; launching again shows the existing window.
- Backend health moved from the dashboard to Settings.
- Production Content Security Policy no longer allows inline styles.
- Every app command now requires an explicit permission in the window's capability.

### Fixed
- Overlapping refreshes could show an older port list.
- The details panel could show a socket that no longer existed.
- Dashboard and Favorites used separate rules for "in use".
- State labels were lower-cased incorrectly in Portuguese on the Favorites page.

## [0.1.0] - 2026-11-21

### Added
- Port discovery for IPv4/IPv6 TCP sockets with owning process, searchable, filterable and
  sortable table, and dashboard summary.
- Process details and confirmed process termination with protection for critical Windows
  processes.
- Favorite ports stored in SQLite.
