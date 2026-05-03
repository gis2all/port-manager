use anyhow::{bail, Result};
use async_trait::async_trait;
use pm_ports::{CommandRunHandle, CommandRunner, StartCommandRequest};
use tokio::process::Command;

pub struct LocalCommandRunner;

#[cfg(windows)]
fn shell_command(command: &str) -> Command {
    let mut shell = Command::new("powershell");
    shell.args(["-NoProfile", "-Command", command]);
    shell
}

#[cfg(not(windows))]
fn shell_command(command: &str) -> Command {
    let mut shell = Command::new("sh");
    shell.args(["-lc", command]);
    shell
}

#[cfg(windows)]
async fn stop_tree(root_pid: u32) -> Result<()> {
    let status = Command::new("taskkill")
        .args(["/PID", &root_pid.to_string(), "/T", "/F"])
        .status()
        .await?;

    if status.success() {
        Ok(())
    } else {
        bail!("taskkill failed for pid {root_pid}")
    }
}

#[cfg(not(windows))]
async fn stop_tree(root_pid: u32) -> Result<()> {
    let status = Command::new("kill")
        .args(["-9", &root_pid.to_string()])
        .status()
        .await?;

    if status.success() {
        Ok(())
    } else {
        bail!("kill failed for pid {root_pid}")
    }
}

#[async_trait]
impl CommandRunner for LocalCommandRunner {
    async fn start(&self, request: StartCommandRequest) -> Result<CommandRunHandle> {
        let mut command = shell_command(&request.command);
        if let Some(workdir) = &request.workdir {
            command.current_dir(workdir);
        }

        let child = command.spawn()?;
        let root_pid = child
            .id()
            .ok_or_else(|| anyhow::anyhow!("spawned command did not expose a pid"))?;

        Ok(CommandRunHandle {
            root_pid,
            child_pids: Vec::new(),
            log_path: None,
        })
    }

    async fn stop(&self, root_pid: u32) -> Result<()> {
        stop_tree(root_pid).await
    }
}
