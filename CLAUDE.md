# Port Manager 项目说明

## 项目定位
Port Manager 是一个以 Windows 桌面为主目标的端口管理工具，当前主交付形态是 Tauri 桌面应用，不是网页后台。

它解决的是一组紧密相关的问题：
- 统一查看本机端口、监听地址、进程、PID 和状态。
- 把端口和“受管服务”关联起来，支持从 UI 直接启动、停止、登记服务。
- 支持收藏重点端口和重点服务，集中在收藏页做快速操作。
- 在桌面端维持高信息密度、控制台式工作流，而不是做通用 SaaS 风格管理页。

## 当前产品范围
当前前端主要有三页：
- `端口总览`
- `服务编排`
- `收藏夹`

右侧固定详情栏会根据当前页切换展示：
- 端口详情
- 服务详情
- 收藏概览

这不是一个“端口启动器”。
- “停止端口”本质上是结束占用该端口的进程。
- “启动端口”本质上是启动与该端口关联的受管服务。

## 技术栈
- Rust workspace
- Tauri 2
- React 18
- TypeScript
- Vite
- TanStack Query
- SQLite

Windows 侧真实能力来自 Rust 适配层，包括：
- 本机端口扫描
- 进程结束
- Windows 服务控制
- 本地命令启动

## 仓库结构

### 顶层目录
- `apps/desktop`
  - Tauri 桌面前端与桌面壳。
- `apps/cli`
  - 命令行入口。
- `crates/domain`
  - 领域对象与核心枚举。
- `crates/ports`
  - 端口抽象接口层。
- `crates/application`
  - 应用服务、DTO、业务编排。
- `crates/adapters/windows`
  - Windows 端口/进程/服务能力适配器。
- `crates/adapters/sqlite`
  - SQLite 存储实现。
- `crates/adapters/runner`
  - 本地命令执行器。
- `crates/interfaces/tauri_api`
  - Tauri 命令接口层与桌面态 AppState。
- `crates/interfaces/cli_api`
  - CLI 接口层。
- `data`
  - 本地运行数据目录，当前数据库放在这里。
- `docs`
  - 本地设计与规划文档目录，已忽略版本控制。

## Rust Workspace 分层

### domain
`crates/domain` 定义核心领域对象：
- `PortRecord`
- `ManagedService`
- `ManagedServiceRun`
- `Favorite`
- `FavoriteTarget`
- `PortProtocol`
- `PortStatus`
- `ServiceKind`
- `ServiceRunStatus`

### ports
`crates/ports` 定义抽象能力接口：
- `PortProvider`
- `ProcessController`
- `ServiceController`
- `CommandRunner`
- `FavoriteRepository`
- `ManagedServiceRepository`
- `RunStateRepository`

### application
`crates/application` 负责业务编排和前端 DTO：
- `PortManagerService`
- `DashboardSnapshotDto`
- `PortDto`
- `ManagedServiceDto`
- `ManagedServiceDraftDto`

### adapters
当前主要适配器有三类：
- `windows`
  - 对接 Windows 端口、进程、服务。
- `sqlite`
  - 持久化收藏、受管服务、运行状态。
- `runner`
  - 负责执行本地命令型服务。

### interfaces
- `tauri_api`
  - 暴露给桌面端的 command。
- `cli_api`
  - 暴露给 CLI 的命令封装。

## 桌面端结构

### 关键文件
- `D:/Code/port-manager/apps/desktop/src/App.tsx`
  - 桌面主壳。
  - 负责左侧导航、顶部窗口栏、中间页面区、右侧详情栏、活动日志联动、轮询刷新和动作派发。
- `D:/Code/port-manager/apps/desktop/src/features/ports/PortsPage.tsx`
  - 端口总览页。
- `D:/Code/port-manager/apps/desktop/src/features/services/ServicesPage.tsx`
  - 服务编排页。
- `D:/Code/port-manager/apps/desktop/src/features/favorites/FavoritesPage.tsx`
  - 收藏夹页。
- `D:/Code/port-manager/apps/desktop/src/components/ScanCard.tsx`
  - 三页共用扫描卡。
- `D:/Code/port-manager/apps/desktop/src/components/SelectMenu.tsx`
  - 自定义下拉控件。
- `D:/Code/port-manager/apps/desktop/src/components/StatusPill.tsx`
  - 状态胶囊标签。
- `D:/Code/port-manager/apps/desktop/src/lib/api.ts`
  - 前端统一 API 入口。
- `D:/Code/port-manager/apps/desktop/src/lib/mockBackend.ts`
  - 浏览器预览模式下的 mock 数据与行为。
- `D:/Code/port-manager/apps/desktop/src/lib/dashboard.ts`
  - 端口/服务聚合与行级 key 辅助函数。
- `D:/Code/port-manager/apps/desktop/src/lib/presentation.ts`
  - 状态文案、空值文案、展示格式辅助函数。
- `D:/Code/port-manager/apps/desktop/src/lib/types.ts`
  - 前端 DTO 类型定义。
- `D:/Code/port-manager/apps/desktop/src/styles.css`
  - 全局样式系统与桌面布局。
- `D:/Code/port-manager/apps/desktop/src-tauri/src/main.rs`
  - Tauri 入口与 command 注册。
- `D:/Code/port-manager/apps/desktop/src-tauri/tauri.conf.json`
  - 窗口默认尺寸、居中、装饰和 dev/build 配置。

## 当前桌面端运行方式

### 桌面端是主基线
最终视觉和交互基线以 Tauri 窗口为准，不以浏览器页面为准。

### 前端 dev 入口
在 `D:/Code/port-manager/apps/desktop` 下：
- `npm run dev`
- `npm run build`
- `npm run typecheck`

### Tauri dev 入口
通常在 `D:/Code/port-manager/apps/desktop` 下运行：
- `npx @tauri-apps/cli dev`

### Rust 校验
在仓库根目录：
- `cargo check --workspace`
- `cargo test --workspace`

## 当前窗口配置
桌面窗口默认配置在 `D:/Code/port-manager/apps/desktop/src-tauri/tauri.conf.json`：
- 默认宽度 `1684`
- 默认高度 `1024`
- `center: true`
- 可缩放
- 自定义无系统装饰标题栏
- 默认背景色 `#0b1017`

这意味着：
- 启动后默认居中。
- 默认尺寸已经按当前用户常用窗口大小固化。
- 仍允许拖拽缩放和最大化，不是锁死尺寸。

## 数据链路

### 桌面端真实链路
桌面运行时默认走真实 Tauri command：
- `get_dashboard_snapshot`
- `kill_process_by_port`
- `toggle_port_favorite`
- `toggle_service_favorite`
- `save_managed_service`
- `delete_managed_service`
- `start_managed_service`
- `stop_managed_service`

前端通过 `@tauri-apps/api/core` 的 `invoke` 调用这些命令。

### 浏览器预览链路
只有在非 Tauri 环境下，前端才会走 `mockBackend.ts`。

也就是说：
- 桌面 dev 默认是实时数据。
- 浏览器预览才是 mock 数据。
- 之前的 screenshot mode 已经移除，不再作为当前机制保留。

## 当前 DTO
前端和桌面端主要围绕这些 DTO 工作：

### PortDto
- `port`
- `protocol`
- `listen_address`
- `pid`
- `process_name`
- `status`
- `is_favorite`
- `matched_service_id`
- `matched_service_name`

### ManagedServiceDto
- `id`
- `name`
- `kind`
- `service_name`
- `workdir`
- `start_command`
- `expected_ports`
- `observed_ports`
- `status`
- `is_favorite`

### ManagedServiceDraftDto
- `name`
- `kind`
- `service_name`
- `workdir`
- `start_command`
- `expected_ports`

### DashboardSnapshotDto
- `ports`
- `services`

### 前端本地 UI 数据
前端还维护一类非后端 DTO 的本地状态：
- `ActivityEntry`
  - 用于活动日志。
  - 来源是用户动作日志和轮询快照 diff。

## 轮询与活动日志
- 仪表盘通过 React Query 每 `5` 秒轮询一次 `get_dashboard_snapshot`。
- 手动刷新也会触发重新拉取。
- 活动日志不是后端事件流。
- 当前活动日志由两部分组成：
  - 用户动作，例如刷新、收藏、启停、删除。
  - 前端比较前后两次 `DashboardSnapshotDto` 的差异后生成的轻量事件。

## 端口行唯一性约定
端口表当前不能只用 `port number` 做选中态，因为同端口号可能有多条记录。

前端已改为使用行级 key：
- `getPortRowKey(port)`

组合字段包括：
- `port`
- `protocol`
- `listen_address`
- `pid`
- `process_name`
- `matched_service_id`

相关逻辑集中在：
- `D:/Code/port-manager/apps/desktop/src/lib/dashboard.ts`

这会影响：
- 主表选中高亮
- 右侧详情联动
- 收藏页跳转到具体端口行
- 端口收藏切换

## 收藏逻辑说明
- 服务收藏仍按 `service id` 切换。
- 端口收藏已经不是只按 `port number` 处理，而是会同时传 `rowKey + port + isFavorite`，避免重复端口误伤到别的行。

## 数据库存储
本地 SQLite 数据库当前放在：
- `D:/Code/port-manager/data/port-manager.db`

对应代码位置：
- `D:/Code/port-manager/crates/interfaces/tauri_api/src/state.rs`
- `D:/Code/port-manager/crates/interfaces/cli_api/src/commands.rs`

当前会自动确保 `data/` 目录存在。

数据库文件默认被 `.gitignore` 忽略：
- `data/*.db`
- `data/*.db-shm`
- `data/*.db-wal`

## CLI 现状
CLI 入口在：
- `D:/Code/port-manager/apps/cli/src/main.rs`

当前 CLI 子命令较轻，主要用于：
- `scan-ports`
- `kill-port`
- `favorite port`
- `favorite service`

它和桌面端共享同一个 Rust 应用服务层，也共享 `data/port-manager.db`。

## 当前 UI 设计基线

### 总体方向
当前 UI 是高密度暗色桌面控制台风格：
- 左侧窄导航
- 中部主工作区
- 右侧固定详情栏
- 自定义顶部窗口栏
- 高信息密度表格
- 中文业务文案

### 当前用户强调的视觉规则
这是近期已经反复明确过的方向，后续修改应默认遵守：
- 以桌面窗口为视觉基线，不拿网页预览当最终结果。
- 顶部 bar 要更低、更紧凑。
- 表格行高要固定，并保持紧密。
- 面板高度、底部双栏宽度要尽量统一。
- 重点端口、收藏端口摘要、服务健康、收藏服务等列表行高要固定。
- 活动日志内容尽量保持单行，不做多余解释信息。
- 多处矩形控件圆角统一收紧到 `2px`。
- 一些状态类控件不再要矩形包裹，倾向圆点加纯文字。
- 右侧详情文字不应过白，整体层级需要更克制。
- 表格区域尽量“直接是表格”，不要冗余说明性副文本。

## 品牌与图标
品牌图标已经统一重做并同步到：
- 标题栏品牌图标
- 浏览器 favicon
- Tauri/Windows 应用图标

关键资源：
- `D:/Code/port-manager/apps/desktop/public/brand-icon.svg`
- `D:/Code/port-manager/apps/desktop/public/brand-icon.png`
- `D:/Code/port-manager/apps/desktop/public/favicon.png`
- `D:/Code/port-manager/apps/desktop/public/favicon.ico`
- `D:/Code/port-manager/apps/desktop/src-tauri/icons/icon.png`
- `D:/Code/port-manager/apps/desktop/src-tauri/icons/icon.ico`

任务栏图标曾因为系统缓存与亮度问题做过额外调整。
当前 Rust 启动时会显式把默认窗口图标设置到主窗口，减少任务栏图标不刷新的问题。

## 已废弃或已移除的约定
- 不再使用 screenshot mode。
- 不再使用 `VITE_SCREENSHOT_MODE` 视觉基线机制。
- 不再保留 `start-tauri-dev.cmd` / `start-tauri-dev.ps1` 启动脚本。
- 仓库内调试截图已经按批次清理，截图类文件默认不应提交。

## 仓库忽略与本地产物
当前 `.gitignore` 已忽略这些常见本地产物：
- `target`
- `node_modules`
- `apps/desktop/dist`
- `apps/desktop/src-tauri/target`
- `apps/desktop/src-tauri/gen`
- `.playwright-mcp`
- `.codex-run`
- `docs`
- 各类本地截图 PNG
- `*.log`
- `data/*.db*`

如果后续新增调试脚本、截图、对比图或运行日志，默认也应该走忽略规则，不要直接入库。

## 当前开发注意点
- 桌面端默认必须优先验证真实 Tauri 数据，不要误把浏览器 mock 结果当真机结果。
- `mockBackend.ts` 只服务于非 Tauri 预览，不要把桌面逻辑重新绕回 mock。
- 端口重复行的交互必须用 `getPortRowKey`，不能回退成只按端口号处理。
- 端口收藏也要按行级 key 走，不能只切某个端口号。
- 修改中文文案、Markdown、TSX、JSON、CSS 时，要注意 Windows/PowerShell 下的编码安全。
- 大图尽量走本地文件附件，不要走超长 data URL。
- 用户非常在意“肉眼可见的桌面结果”，做完布局改动后应优先启动 Tauri 窗口核对。

## 推荐开发顺序
如果后续继续迭代，建议顺序是：
1. 先确认 Rust 能力和 DTO 是否足够支撑需求。
2. 再确认 Tauri command 层是否已暴露所需动作。
3. 然后改前端状态流与交互逻辑。
4. 最后再做桌面视觉微调与像素级校正。

## 快速接手结论
如果是新一轮开发，先记住这几条：
- 主交付是 Tauri 桌面窗口。
- 桌面 dev 默认走真实数据，不走截图模式。
- 数据库在 `data/port-manager.db`。
- 端口选中和端口收藏必须按行级 key 处理。
- 当前窗口默认 `1684 x 1024`，启动居中。
- 图标资源和任务栏图标逻辑已经统一，不要只改单一入口。
