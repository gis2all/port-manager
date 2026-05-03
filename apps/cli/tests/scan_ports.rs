use clap::Parser;
use pm_cli_api::{Cli, Commands, OutputFormat};

#[test]
fn cli_scan_ports_parses_json_format() {
    let cli = Cli::parse_from(["pm-cli", "scan-ports", "--format", "json"]);

    match cli.command {
        Commands::ScanPorts { format } => assert_eq!(format, OutputFormat::Json),
        other => panic!("unexpected command: {other:?}"),
    }
}
