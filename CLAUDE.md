# Port Manager 项目说明

## 项目一句话
Port Manager 是一个以 Windows 为优先目标的桌面端端口管理工具，用来统一查看本机端口、关联进程、受管服务，以及对重点对象进行收藏和快捷控制。

## 当前产品目标
- 查看本机全部端口、监听地址、进程名、PID 和状态。
- 支持结束占用某个端口的进程。
- 支持启动、停止与端口关联的受管服务。
- 支持收藏端口和收藏服务，并集中展示在收藏页。
- 前端保持低耦合，优先围绕后端能力和稳定 DTO 建模。

## 技术栈
- Rust workspace
- Tauri 2
- React 18 + TypeScript + Vite
- React Query
- SQLite
- Windows 侧能力包括端口扫描、进程控制、Windows 服务控制和命令服务启动

## 代码结构

### 根目录
- `apps/desktop`
  - 桌面端前端，React + Tauri 壳层。
- `crates/*`
  - Rust 后端工作区，承载领域模型、应用层、适配器和接口层。
- `start-tauri-dev.cmd`
  - Windows 下推荐的桌面端启动脚本。
  - 会补齐 Rust toolchain PATH，并切到 `apps/desktop` 后执行 `npx @tauri-apps/cli dev`。
- `start-tauri-dev.ps1`
  - 上述启动方式的 PowerShell 版本。
- `docs`
  - 设计文档与计划文档。当前已加入 `.gitignore`。

### 前端目录
- `apps/desktop/src/App.tsx`
  - 应用主壳层。
  - 负责左侧导航、顶部共享信息、右侧详情面板、底部状态栏，以及全局查询和动作编排。
- `apps/desktop/src/features/ports/PortsPage.tsx`
  - 端口主控台页面。
- `apps/desktop/src/features/services/ServicesPage.tsx`
  - 服务编排页面。
- `apps/desktop/src/features/favorites/FavoritesPage.tsx`
  - 收藏聚合页面。
- `apps/desktop/src/components/StatusPill.tsx`
  - 通用状态标签。
- `apps/desktop/src/lib/api.ts`
  - 前端统一 API 入口。
  - 在浏览器预览模式下调用 mock backend，在 Tauri 模式下调用 `invoke`。
- `apps/desktop/src/lib/mockBackend.ts`
  - 浏览器预览用的模拟后端。
- `apps/desktop/src/lib/dashboard.ts`
  - 仪表盘聚合辅助函数。
- `apps/desktop/src/lib/presentation.ts`
  - 端口/服务状态与文案格式化辅助函数。
- `apps/desktop/src/styles.css`
  - 全局样式系统，当前是统一的暗色桌面控制台风格。
- `apps/desktop/src-tauri/capabilities/desktop-window.json`
  - 自定义标题栏和窗口控制相关 capability 配置。

## 运行模式

### 浏览器预览模式
- 使用 `apps/desktop/src/lib/mockBackend.ts` 提供假数据。
- 适合验证页面结构、状态切换、样式和交互。

### Tauri 桌面模式
- 使用 `apps/desktop/src/lib/api.ts` 调用 `@tauri-apps/api/core` 的 `invoke`。
- 默认包括 dev 在内都走真实本机端口、进程和服务数据链路。
- 当前前端保留固定的桌面布局基线，但不再提供独立的截图模式开关。

## 当前前端信息架构

### 共用骨架
- 左侧品牌导航
- 顶部共享信息区
- 中央主工作区
- 右侧固定详情检视器
- 底部全局状态栏

### 三个主页面
- `端口总览`
  - 顶部指标带
  - 密集端口表格
  - 底部重点端口 + 活动日志
- `服务编排`
  - 顶部指标带
  - 服务目录主表
  - 底部快速录入 + 端口覆盖
- `收藏夹`
  - 顶部指标带
  - 收藏队列主表
  - 底部星标服务 + 星标端口

### 详情面板
- 端口页显示端口概览、进程信息、关联服务动作
- 服务页显示服务概览和控制动作
- 收藏页显示收藏统计和重点对象摘要

## 关键业务约定
- “端口”和“服务”是并列对象，不要混为一谈。
- “停止端口”本质上是结束占用该端口的进程。
- “启动端口”不是直接操作端口，而是启动与之关联的受管服务。
- 受管服务分两类：
  - `command`
  - `windows_service`
- 收藏也分两类：
  - 端口收藏
  - 服务收藏

## 主要 DTO / 数据模型
- `PortDto`
- `ManagedServiceDto`
- `ManagedServiceDraftDto`
- `DashboardSnapshotDto`
- `ActivityEntry`

前端尽量围绕这些 DTO 做展示，不要把系统底层实现细节直接泄漏到页面组件里。

## 当前设计风格
- 统一暗色桌面控制台风格
- 左窄导航 + 中央主控台 + 右侧详情面板
- 高信息密度表格
- 青蓝色高亮
- 危险操作单独使用红色层级
- 中文化控制台文案

## 当前 UI 基线
- `Ports` 首屏在 dev 态以截图模式为唯一视觉基线。
- 参考尺寸为 `1536 x 1024`。
- 优先对齐布局比例、间距、圆角、边框、阴影、表格行高、状态 pill 和按钮层级。
- 生产态和真实数据链路仍保留，不因为截图模式而改 DTO、Tauri command 或后端接口名。

## 常用命令

### 桌面端推荐启动
在仓库根目录下：

- `.\start-tauri-dev.cmd`
- `.\start-tauri-dev.ps1`

### 前端
在 `apps/desktop` 目录下：

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npx @tauri-apps/cli dev`

### Rust workspace
在仓库根目录：

- `cargo check --workspace`
- `cargo test --workspace`

## Windows / PowerShell 注意事项
- 默认按 PowerShell 语义执行命令，不要写 bash 风格的 `&&`。
- 修改 `json`、`ts`、`tsx`、`md`、`html`、`yml`、`yaml` 时优先使用 `apply_patch`。
- 编码敏感文件统一保持 BOM-free UTF-8。
- 不要用 `Set-Content`、`Out-File` 等方式写源码、配置和中文文档。
- 本机如果 `cargo` 不在 PATH 里，优先使用仓库根目录的 `start-tauri-dev.*` 启动脚本。
- 做视觉对照时，大图尽量走本地文件附件，不要走超长 data URL。

## 当前已知注意点
- `mockBackend.ts` 的模块初始化顺序不要随意打乱，之前这里出过白屏问题。
- 桌面端开发时，白屏要优先看浏览器控制台、Tauri 日志和 `invoke` 调用链。
- 前端视觉方向已经明确为“密集型暗色桌面控制台”，不要退回通用白板式后台样式。
- 目前 `docs/` 已被忽略，本地设计稿和计划默认不参与版本控制。
- `.codex-run/`、本地截图对照图、窗口检查图等调试产物已加入 `.gitignore`，默认不参与版本控制。

## 建议开发顺序
1. 先补后端能力与测试。
2. 再补接口层和 Tauri command。
3. 再接前端交互。
4. 最后做视觉细节与体验打磨。
