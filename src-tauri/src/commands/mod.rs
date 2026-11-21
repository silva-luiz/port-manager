//! Tauri command handlers. Each submodule exposes a narrowly scoped set of
//! commands; OS-specific logic lives in dedicated modules, never here.

pub mod favorites;
pub mod health;
pub mod ports;
pub mod process;
pub mod settings;
