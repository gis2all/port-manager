use anyhow::{bail, Result};
use async_trait::async_trait;
use pm_ports::{
    CommandRunHandle, CommandRunner, CommandStopResult, StartCommandRequest, StopCommandRequest,
};
use std::fs::{self, File};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use sysinfo::{Pid, System};
use tokio::process::Command;
use tokio::time::sleep;

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

fn workspace_data_dir() -> Result<PathBuf> {
    let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../data");
    fs::create_dir_all(&data_dir)?;
    Ok(data_dir)
}

fn log_dir() -> Result<PathBuf> {
    let dir = workspace_data_dir()?.join("logs");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn sanitize_file_segment(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|ch| match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => ch,
            _ => '-',
        })
        .collect::<String>()
        .trim_matches('-')
        .to_owned();

    if sanitized.is_empty() {
        "service".to_owned()
    } else {
        sanitized
    }
}

fn build_log_path(request: &StartCommandRequest) -> Result<PathBuf> {
    let unix_seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    Ok(log_dir()?.join(format!(
        "{}-{}-{}.log",
        sanitize_file_segment(&request.service_name),
        sanitize_file_segment(&request.service_id),
        unix_seconds
    )))
}

fn collect_descendants(system: &System, root_pid: u32) -> Vec<u32> {
    let mut discovered = Vec::new();
    let mut queue = vec![Pid::from_u32(root_pid)];

    while let Some(parent) = queue.pop() {
        for (pid, process) in system.processes() {
            if process.parent() == Some(parent) {
                let child = pid.as_u32();
                if !discovered.contains(&child) {
                    discovered.push(child);
                    queue.push(*pid);
                }
            }
        }
    }

    discovered.sort_unstable();
    discovered
}

fn is_pid_running(pid: u32) -> bool {
    let system = System::new_all();
    system.process(Pid::from_u32(pid)).is_some()
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

async fn wait_for_process_exit(root_pid: u32, timeout: Duration) -> bool {
    let started = SystemTime::now();
    while started.elapsed().unwrap_or_default() < timeout {
        if !is_pid_running(root_pid) {
            return true;
        }
        sleep(Duration::from_millis(250)).await;
    }
    !is_pid_running(root_pid)
}

#[async_trait]
impl CommandRunner for LocalCommandRunner {
    async fn start(&self, request: StartCommandRequest) -> Result<CommandRunHandle> {
        let mut command = shell_command(&request.command);
        if let Some(workdir) = &request.workdir {
            command.current_dir(workdir);
        }

        let log_path = build_log_path(&request)?;
        let stdout = File::create(&log_path)?;
        let stderr = stdout.try_clone()?;
        command.stdout(Stdio::from(stdout));
        command.stderr(Stdio::from(stderr));

        let child = command.spawn()?;
        let root_pid = child
            .id()
            .ok_or_else(|| anyhow::anyhow!("spawned command did not expose a pid"))?;
        sleep(Duration::from_millis(400)).await;

        let system = System::new_all();
        let child_pids = collect_descendants(&system, root_pid);

        Ok(CommandRunHandle {
            root_pid,
            child_pids,
            log_path: Some(log_path.to_string_lossy().into_owned()),
        })
    }

    async fn stop(&self, request: StopCommandRequest) -> Result<CommandStopResult> {
        let mut last_exit_code = None;
        let mut child_pids = {
            let system = System::new_all();
            let detected = collect_descendants(&system, request.root_pid);
            if detected.is_empty() {
                request.child_pids.clone()
            } else {
                detected
            }
        };

        let mut stopped_gracefully = false;
        if let Some(stop_command) = request.stop_command.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            let mut command = shell_command(stop_command);
            if let Some(workdir) = &request.workdir {
                command.current_dir(workdir);
            }

            let status = command.status().await?;
            last_exit_code = status.code();
            if status.success() {
                stopped_gracefully = wait_for_process_exit(request.root_pid, Duration::from_secs(8)).await;
            }
        }

        if !stopped_gracefully && is_pid_running(request.root_pid) {
            stop_tree(request.root_pid).await?;
        }

        if child_pids.is_empty() {
            let system = System::new_all();
            child_pids = collect_descendants(&system, request.root_pid);
        }

        Ok(CommandStopResult {
            child_pids,
            last_exit_code,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_log_path_uses_service_identity_and_data_logs_directory() {
        let path = build_log_path(&StartCommandRequest {
            service_id: "11111111-1111-4111-8111-111111111111".into(),
            service_name: "My API/Web".into(),
            command: "npm run dev".into(),
            workdir: Some("D:/Code/example".into()),
        })
        .expect("log path");

        let path_text = path.to_string_lossy();
        assert!(path_text.contains("data"));
        assert!(path_text.contains("logs"));
        assert!(path_text.contains("My-API-Web"));
        assert!(path_text.ends_with(".log"));
    }
}
