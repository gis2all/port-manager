@echo off
set PATH=C:\Users\12620\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;%PATH%
cd /d D:\Code\port-manager\apps\desktop
"C:\Program Files\nodejs\npx.cmd" @tauri-apps/cli dev
