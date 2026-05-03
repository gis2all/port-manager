# Port Manager 项目说明

## 项目一句话
Port Manager 是一个 **Windows 优先** 的通用桌面端口管理工具，用来查看本机端口、定位占用进程、结束占用、管理 Windows 服务 / 自定义命令服务，并支持收藏端口和收藏服务。

## 当前目标
- 查看本机所有端口、对应进程、状态和监听地址。
- 一键结束指定端口的占用进程。
- 启动、停止、重启与端口关联的受管服务。
- 收藏端口和服务，并在仪表盘中集中查看。
- 后续能力优先放在后端，再接前端。

## 技术栈
- Rust workspace
- Tauri 2
- React + TypeScript + Vite
- SQLite
- React Query
- Windows 侧能力：`netstat2`、`sysinfo`、`windows-service`、命令运行器

## 代码架构
项目采用低耦合的模块化单体，边界按六边形架构拆分。

- `crates/domain`
  - 只放业务实体、值对象和规则。
  - 不依赖 Tauri、SQLite、Windows API。
- `crates/ports`
  - 定义抽象接口。
  - 例如端口扫描、进程控制、服务控制、命令运行、收藏仓储、服务仓储。
- `crates/application`
  - 编排用例，产出稳定 DTO。
  - 负责把 domain、ports、adapters 组合成业务流程。
- `crates/adapters/*`
  - `windows`：端口扫描、PID 映射、结束进程、Windows 服务控制。
  - `sqlite`：收藏、受管服务、运行状态持久化。
  - `runner`：自定义命令服务的启动/停止/追踪。
- `crates/interfaces/*`
  - `cli_api`：给 CLI 暴露用例入口。
  - `tauri_api`：给桌面端暴露 Tauri commands。
- `apps/cli`
  - 命令行入口，主要用于验证后端能力。
- `apps/desktop`
  - React 前端 + Tauri 壳。
  - 浏览器模式走 mock 数据，桌面模式走真实 Tauri invoke。

依赖方向保持为：

`interface -> application -> domain/ports <- adapters`

## 关键业务约定
- `端口` 和 `服务` 是并列概念，不要互相替代。
- “停止端口”本质上是结束占用该端口的进程。
- “启动端口”不是直接操作端口，而是启动与之关联的受管服务。
- 受管服务分两类：
  - `windows_service`
  - `command`
- 收藏分两类：
  - 端口收藏
  - 服务收藏
- 外部已运行进程只能尽量识别和关联，不要假装百分百准确。

## 主要数据模型
- `PortRecord`
- `ManagedService`
- `ManagedServiceRun`
- `Favorite`
- `DashboardSnapshotDto`

前端和接口层都围绕这些模型做展示和交互，尽量不要把系统细节泄露到 UI。

## 前端运行模式
- 浏览器预览时，`apps/desktop/src/lib/mockBackend.ts` 提供模拟数据。
- 真正打开 Tauri 桌面窗口时，`apps/desktop/src/lib/api.ts` 会调用 `@tauri-apps/api/core` 的 `invoke`。
- 所以前端调试时要分清：
  - 浏览器白页：优先看 React / mock backend / Vite。
  - 桌面白页：优先看 Tauri 启动和 WebView 运行时报错。

## 常用命令
在 `apps/desktop` 下：

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npx @tauri-apps/cli dev`

在仓库根目录：

- `cargo check --workspace`
- `cargo test --workspace`

## Windows / PowerShell 注意事项
- 默认按 PowerShell 语义处理命令，不要写 bash 风格命令串。
- 写 `json`、`ts`、`tsx`、`md`、`html`、`yml`、`yaml` 时，优先用 `apply_patch`。
- 需要写文件时，优先保持 BOM-free UTF-8。
- 不要用 `Set-Content` / `Out-File` 去写编码敏感文件。
- 这台机器上 Rust 工具链有时不在默认 `PATH`，必要时先加：

```powershell
$env:PATH='C:\Users\12620\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;'+$env:PATH
```

## 当前仓库状态
- 后端 workspace 已经搭好，并且有 CLI 与 Tauri 两个接口入口。
- 桌面端 UI 已经不是空壳，当前是深色仪表盘风格。
- 桌面端支持收藏、活动日志、端口详情、服务详情、端口表格和底部状态栏。
- `apps/desktop/src-tauri/tauri.conf.json` 的开发启动命令已经修正为 `npm run dev`。

## 已知容易踩坑的地方
- 不要把 `mockBackend.ts` 的模块初始化顺序改坏，否则桌面会再次白屏。
- 不要直接删除或回退用户已有改动。
- 如果看到白屏，先查控制台和 `tauri-dev.err.log`，不要先猜。
- 前端视觉方向是“密集型深色仪表盘”，不要退回成默认白板布局。

## 开发顺序建议
1. 先补后端用例和测试。
2. 再补 CLI 接口。
3. 再补 Tauri 接口。
4. 最后再改前端交互和样式。

## 参考文档
- 设计稿和计划在 `docs/superpowers/specs/2026-05-03-port-manager-design.md`
- 实施计划在 `docs/superpowers/plans/2026-05-03-port-manager.md`
