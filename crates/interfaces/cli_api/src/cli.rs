use clap::{Parser, Subcommand, ValueEnum};
use uuid::Uuid;

#[derive(Debug, Parser)]
#[command(name = "pm-cli", version, about = "Port Manager CLI")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    ScanPorts {
        #[arg(short, long, value_enum, default_value_t = OutputFormat::Json)]
        format: OutputFormat,
    },
    KillPort {
        port: u16,
    },
    Favorite {
        #[command(subcommand)]
        action: FavoriteAction,
    },
}

#[derive(Debug, Subcommand)]
pub enum FavoriteAction {
    Port {
        port: u16,
    },
    Service {
        service_id: Uuid,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum OutputFormat {
    Json,
    Table,
}
