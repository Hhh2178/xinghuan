# Canvas Agent 认证 UI 验收

## 边界

此流程只用于本地隔离环境或 Gray 的一次性测试账号与可丢弃画布。不得在 Production 上创建 Canvas Run、修改画布或执行模型任务。账号、密码、Cookie、截图中的用户数据和运行 ID 都不得写入 Git、文档或日志。

前置条件：

- 已准备当前候选版本对应的 API、Web、PostgreSQL 和 Worker。
- 测试账号仅拥有自己的测试项目，并具有可用的 `native_server` 节点配置。
- Agent 配置、公开知识 publication、Canvas Run 和质量开关已在目标环境按验收需要发布；未发布配置的受限 fallback 不是成功验收。
- `npx` 可用，并设置 `XINGHUAN_AGENT_UI_BASE_URL`、`XINGHUAN_AGENT_UI_EMAIL` 与 `XINGHUAN_AGENT_UI_PASSWORD`。变量只保留在当前终端进程。

## Playwright CLI 流程

使用固定 session，先打开页面并取得当前 snapshot。每次导航、打开工作台或切换 Tab 后必须重新 snapshot，不能复用旧 element ref。

```powershell
$env:PLAYWRIGHT_CLI_SESSION = "canvas-agent-acceptance"
$env:PWCLI = "C:\Users\Administrator\.codex\skills\playwright\scripts\playwright_cli.sh"
& $env:PWCLI open $env:XINGHUAN_AGENT_UI_BASE_URL --headed
& $env:PWCLI snapshot
```

根据刚取得的 ref 填写邮箱和密码并登录。登录完成后再次 snapshot，确认画布工作区已加载；不要把 ref、账号或 Cookie 记录到本文件。

```powershell
& $env:PWCLI fill eX $env:XINGHUAN_AGENT_UI_EMAIL
& $env:PWCLI fill eY $env:XINGHUAN_AGENT_UI_PASSWORD
& $env:PWCLI click eZ
& $env:PWCLI snapshot
```

`eX`、`eY` 和 `eZ` 是每次 snapshot 产生的临时 ref，必须替换为当前终端输出中的实际值。随后执行：

1. 以 1440x1000 打开标题为“打开画布助手”的 launcher，确认出现 aria-label 为“画布 AI 工作台”的工作台，截取一张截图到 `output/playwright/`。
2. 在协作 Tab 发送只读问题，确认返回内部 Agent 或受限 fallback 的可解释状态，且没有暴露 Provider Key、内部知识或其他 owner 的数据。
3. 打开“托管”Tab，确认“生成运行计划”只针对当前画布的 revision；创建计划后确认 Run Plan、分组顺序、拓扑步骤和 SSE 连接状态可见。
4. 仅在可丢弃画布且已明确允许执行时，开始一个最小 `native_server` 测试 Run，依次验证暂停、继续、取消以及刷新后仍读取同一服务端权威状态。不要在此流程验证 `legacy_browser` 节点的页面关闭托管。
5. 将视口调整为 800x1000 与 390x844，重复打开工作台和托管 Tab，检查文本、操作按钮、抽屉和画布不重叠；每个尺寸保存一张截图。
6. 每个关键切换后执行 `snapshot`，最终检查 `console` 中是否存在由 Canvas Agent 引入的 error。完成后删除测试画布或按环境数据留存规则处理。

## 通过标准

- 登录后的普通用户只能看到自己的 canvas、Run、事件、审批和知识 publication。
- 悬浮助手、图片附件入口、协作会话和托管面板均可交互，且状态来自真实 API/SSE，不是浏览器伪进度。
- Canvas Run 的计划、开始、暂停、继续、取消和刷新遵循服务端状态；页面刷新或短暂断线后不产生重复命令。
- 桌面、窄桌面和移动宽度均没有文本溢出、控件遮挡或画布不可操作区域。
- 验收记录只保存环境、候选版本、匿名化的结果和截图路径；不保存凭据、Cookie、内部 URL 参数或用户内容。

## 当前状态

本机隔离环境已完成一次真实登录、悬浮工作台打开、托管计划创建与 1440x1000、800x1000、390x844 响应式检查。托管面板确认展示锁定 revision、拓扑步骤和在线 SSE；唯一 console error 是 Vite 开发环境缺少 `favicon.ico` 的 404，不属于 Canvas Agent。该次 UI 检查未在浏览器内执行 Worker 结算，后者以 `test:canvas-run-local-e2e` 的 API/Redis/Worker 联合验收为证据；Gray 认证验收仍未完成。
