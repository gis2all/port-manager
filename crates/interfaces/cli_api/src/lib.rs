pub mod cli;
mod commands;

pub use cli::{Cli, Commands, FavoriteAction, OutputFormat};
pub use commands::run;
