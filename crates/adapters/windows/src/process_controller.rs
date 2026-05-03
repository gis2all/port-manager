use anyhow::{bail, Result};
use async_trait::async_trait;
use pm_ports::ProcessController;
use sysinfo::{Pid, System};

pub struct WindowsProcessController;

#[async_trait]
impl ProcessController for WindowsProcessController {
    async fn kill_pid(&self, pid: u32) -> Result<()> {
        let system = System::new_all();
        let pid = Pid::from_u32(pid);
        let process = system
            .process(pid)
            .ok_or_else(|| anyhow::anyhow!("process {pid} not found"))?;

        if process.kill() {
            Ok(())
        } else {
            bail!("failed to kill process {pid}")
        }
    }
}
