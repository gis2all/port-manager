$ErrorActionPreference = 'Stop'
$env:PATH = 'C:\Users\12620\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;' + $env:PATH
Set-Location 'D:\Code\port-manager\apps\desktop'
& 'C:\Program Files\nodejs\npx.cmd' @tauri-apps/cli dev
