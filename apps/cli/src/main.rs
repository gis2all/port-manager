use clap::Parser;
use pm_cli_api::{run, Cli};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    println!("{}", run(cli).await?);
    Ok(())
}
