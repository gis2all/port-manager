use anyhow::{bail, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use pm_ports::{ProcessController, ProcessDetails};
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use sysinfo::{Pid, System};

#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Foundation::{GetLastError, HANDLE, HWND};
#[cfg(windows)]
use windows::Win32::Security::WinTrust::{
    WINTRUST_ACTION_GENERIC_VERIFY_V2, WINTRUST_DATA, WINTRUST_DATA_0, WINTRUST_FILE_INFO,
    WINTRUST_SIGNATURE_SETTINGS, WTD_CHOICE_FILE, WTD_REVOKE_NONE, WTD_STATEACTION_IGNORE,
    WTD_UI_NONE, WinVerifyTrust,
};
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    GetFileVersionInfoSizeW, GetFileVersionInfoW, VS_FIXEDFILEINFO, VerQueryValueW,
};

pub struct WindowsProcessController;

fn system_for_process_queries() -> System {
    System::new_all()
}

#[cfg(windows)]
fn to_wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}

#[cfg(windows)]
fn read_file_version(path: &Path) -> Option<String> {
    let wide = to_wide(path.as_os_str());
    let mut handle = 0u32;
    let size = unsafe { GetFileVersionInfoSizeW(PCWSTR(wide.as_ptr()), Some(&mut handle)) };
    if size == 0 {
        return None;
    }

    let mut buffer = vec![0u8; size as usize];
    let ptr = buffer.as_mut_ptr().cast::<core::ffi::c_void>();
    let ok = unsafe {
        GetFileVersionInfoW(
            PCWSTR(wide.as_ptr()),
            Some(handle),
            size,
            ptr,
        )
    };
    if ok.is_err() {
        return None;
    }

    let mut version_ptr: *mut core::ffi::c_void = std::ptr::null_mut();
    let mut version_len = 0u32;
    let query = to_wide(OsStr::new("\\"));
    let ok = unsafe {
        VerQueryValueW(
            buffer.as_ptr().cast(),
            PCWSTR(query.as_ptr()),
            &mut version_ptr,
            &mut version_len,
        )
    };
    if !ok.as_bool() || version_len == 0 || version_ptr.is_null() {
        return None;
    }

    let info = unsafe { &*(version_ptr as *const VS_FIXEDFILEINFO) };
    Some(format!(
        "{}.{}.{}.{}",
        info.dwFileVersionMS >> 16,
        info.dwFileVersionMS & 0xFFFF,
        info.dwFileVersionLS >> 16,
        info.dwFileVersionLS & 0xFFFF
    ))
}

#[cfg(not(windows))]
fn read_file_version(_path: &Path) -> Option<String> {
    None
}

#[cfg(windows)]
fn verify_signature_status(path: &Path) -> Option<String> {
    let wide = to_wide(path.as_os_str());
    let mut file_info = WINTRUST_FILE_INFO {
        cbStruct: std::mem::size_of::<WINTRUST_FILE_INFO>() as u32,
        pcwszFilePath: PCWSTR(wide.as_ptr()),
        hFile: HANDLE::default(),
        pgKnownSubject: std::ptr::null_mut(),
        ..Default::default()
    };
    let mut signature_settings = WINTRUST_SIGNATURE_SETTINGS::default();
    let mut trust_data = WINTRUST_DATA {
        cbStruct: std::mem::size_of::<WINTRUST_DATA>() as u32,
        dwUIChoice: WTD_UI_NONE,
        fdwRevocationChecks: WTD_REVOKE_NONE,
        dwUnionChoice: WTD_CHOICE_FILE,
        Anonymous: WINTRUST_DATA_0 {
            pFile: &mut file_info,
        },
        dwStateAction: WTD_STATEACTION_IGNORE,
        pSignatureSettings: &mut signature_settings,
        ..Default::default()
    };

    let status = unsafe {
        WinVerifyTrust(
            HWND(std::ptr::null_mut()),
            &WINTRUST_ACTION_GENERIC_VERIFY_V2 as *const _ as *mut _,
            &mut trust_data as *mut _ as *mut _,
        )
    };

    if status == 0 {
        Some("有效".into())
    } else {
        let code = unsafe { GetLastError().0 };
        Some(format!("无效 ({code})"))
    }
}

#[cfg(not(windows))]
fn verify_signature_status(_path: &Path) -> Option<String> {
    None
}

#[cfg(windows)]
fn read_file_vendor(path: &Path) -> Option<String> {
    let path_text = path.to_string_lossy().replace('\'', "''");
    let script = format!(
        "(Get-Item '{}').VersionInfo.CompanyName",
        path_text
    );
    run_powershell_capture(&script)
}

#[cfg(not(windows))]
fn read_file_vendor(_path: &Path) -> Option<String> {
    None
}

#[cfg(windows)]
fn run_powershell_capture(script: &str) -> Option<String> {
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    (!text.is_empty()).then_some(text)
}

fn unix_seconds_to_datetime(seconds: u64) -> Option<DateTime<Utc>> {
    DateTime::<Utc>::from_timestamp(seconds as i64, 0)
}

#[async_trait]
impl ProcessController for WindowsProcessController {
    async fn kill_pid(&self, pid: u32) -> Result<()> {
        let system = system_for_process_queries();
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

    async fn is_pid_running(&self, pid: u32) -> Result<bool> {
        let system = system_for_process_queries();
        Ok(system.process(Pid::from_u32(pid)).is_some())
    }

    async fn get_process_details(&self, pid: u32) -> Result<Option<ProcessDetails>> {
        let system = system_for_process_queries();
        let process = match system.process(Pid::from_u32(pid)) {
            Some(process) => process,
            None => return Ok(None),
        };

        let executable_path = process.exe().map(|path| path.to_string_lossy().into_owned());
        let executable = process.exe().map(Path::to_path_buf);

        Ok(Some(ProcessDetails {
            pid,
            executable_path,
            started_at: unix_seconds_to_datetime(process.start_time()),
            working_set_bytes: Some(process.memory()),
            private_bytes: Some(process.virtual_memory()),
            vendor: executable.as_deref().and_then(read_file_vendor),
            file_version: executable.as_deref().and_then(read_file_version),
            digital_signature: executable.as_deref().and_then(verify_signature_status),
        }))
    }
}
