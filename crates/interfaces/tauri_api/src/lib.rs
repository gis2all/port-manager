mod commands;
mod state;

pub use commands::*;
pub use state::{AppState, DesktopService};

pub fn crate_ready() -> bool {
    true
}
