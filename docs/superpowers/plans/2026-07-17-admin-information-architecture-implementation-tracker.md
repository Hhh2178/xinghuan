# Admin 后台信息架构与前端设计体系实施追踪

> **责任范围：** 跟踪 `2026-07-17-admin-information-architecture-and-frontend-design-master-plan.md` 的实施阶段、错误和下一批落点。
> **读取时机：** 开始或恢复本次 Admin 重构时。
> **更新触发：** 每完成一个可独立验证的实施批次后。
> **反重复规则：** 长期系统事实写入 `docs/systems/admin/`，每日证据写入当日日台账，本文件只维护执行状态。

## 目标

产出一份可直接指导实施的完整计划文件，将现有五大后台工作域重构为十个职责明确的一级业务域，并统一导航、路由、页面职责、数据加载、视觉设计、交互动效、迁移顺序与验收标准。

## 阶段

| 阶段 | 状态 | 产出 |
| --- | --- | --- |
| 1. 现状与约束复核 | complete | 代码结构、现有文档、复用资产与主要问题 |
| 2. 信息架构与职责边界 | complete | 十大业务域、页面树、对象归属、跨域关系 |
| 3. 前端设计体系 | complete | 视觉、布局、组件、状态、响应式、可访问性、动效 |
| 4. 技术与迁移计划 | complete | 路由、加载、状态、权限、分批迁移与兼容策略 |
| 5. 验收与文档落盘 | complete | 完整计划文件、索引建议、检查结果 |

## 已确认决策

- 一级业务域从五个扩展为十个。
- 第五个一级业务域命名为“RH 管理”。
- RH 管理只负责 RunningHub 工作流、AI 应用、Key 池、测试与运行记录。
- ComfyUI 管理与 RH 管理分离，作为独立一级业务域。
- 先完成规划与设计文档，再按用户授权实施全部后台重构并推送 Gray。

## 最终产出

- `docs/superpowers/plans/2026-07-17-admin-information-architecture-and-frontend-design-master-plan.md`

## 实施阶段

| 阶段 | 状态 | 产出 |
| --- | --- | --- |
| I0. 现状基线与兼容映射 | complete | 旧标签到新十域路由的映射、验证合同 |
| I1. 路由模型与十域导航 | complete | 声明式路由注册表、URL 同步、十域壳层 |
| I2. 设计 Token 与动效基线 | complete | 新壳层所需视觉与减少动画规则 |
| I3. Phase 1 验证与文档同步 | complete | 类型、构建、合同、CodeGraph 同步和实施记录 |
| I4. 账号、组织、权限路由化 | complete | 五个组织/安全子页稳定 URL，移除重复本地导航 |
| I5. 业务域按需数据加载 | complete | Shell 与 workspace loader 分离，当前域独立取数 |
| I6. Provider、RH 与 ComfyUI 拆分 | complete | Provider/模型、RH 三页、ComfyUI 实例子视图深链 |
| I7. 内容、运行、分析与系统拆分 | complete | 内容双页、任务域、用量/审计、健康/参数/环境同步 |
| I8. 全局前端收口 | complete | 动态 import、路由错误边界、动效 Token、焦点与减少动画 |
| I9. Harness 与 Gray 发布 | complete | 全量验证、本地浏览器验收、v0.8.0 部署与 Gray 运行态证据 |

## 剩余实施批次

- 本计划的实现和 Gray 发布已完成；Production 晋级不在本次授权范围内。

## 错误记录

| 错误 | 处理 |
| --- | --- |
| 早期读取文档时 PowerShell/RTK 编码输出乱码 | 后续以 UTF-8 与精确检索为主，不依赖乱码内容做新增决策 |
| 两个预期文档文件名与仓库实际名称不一致 | 通过 `rg --files` 定位实际文件 |
| 查询设计二进制目录时 PowerShell 变量被外层展开 | 改用显式路径；未发现预期目录，不影响文档计划编写 |
| 当前 CodeGraph CLI 不支持 `context`，且 `files` 不接收路径参数 | 改用 `query`、`impact`、`callers`、`callees` 和精确文件读取 |
| 首次运行新导航合同时旧预期字符串漏掉现有 `comfyui` 标签 | 修正合同基线，同时新增十域顺序与路由解析断言 |
| Playwright 包装脚本使用 Windows `C:/` 路径时 Git Bash 未解析 | 改用 Git Bash 的 `/c/Users/...` 路径 |
| 当前 Bash 实际使用 WSL 挂载，包装脚本 CRLF 导致 `pipefail` 解析失败 | 以只读 `sed` 管道去除行尾，不修改 skill 文件 |
| Playwright CLI 的 WSL 环境没有 Chrome 分发 | 不安装系统浏览器，改用 Codex 应用内浏览器验收 |
| 导航职责下沉后 Starlight 合同仍只扫描 `main.tsx` | 更新合同读取 `use-admin-navigation.ts`，继续验证稳定 URL 与 History API 锚点 |
| UsersPanel 合同仍假设 URL helper 位于 `main.tsx` | 更新合同跨 `main.tsx` 与 navigation hook 验证受控视图链路 |
| 误调用不存在的根脚本 `type-check:admin` | UsersPanel 合同已通过；改用包自有命令 `npm run type-check --workspace @xinghuan/admin` |
| 两个验证脚本名使用了记忆中的单数/contract 后缀 | 通过 `package.json` 确认并改用 `verify:admin-starlight-shell`、`verify:file-hotspot-budgets` |
| 工作区导航条抽离后 Starlight 合同仍要求类名位于 `main.tsx` | 合同改为同时验证主壳与 `admin-shell-workspace-band.tsx`，保持结构约束而不阻碍模块化 |
| ComfyUI 详情改为受控路由后，创建工作流流程仍调用旧 `setActiveTab` | 统一改走 `selectTab`，同时更新本地视图与稳定 URL |
| 页面组件改为 `React.lazy` 后 UsersPanel 合同只接受静态 import | 合同扩展为接受动态 import，同时继续验证组件渲染和受控导航链路 |
| Admin 全合同发现内容域描述重新提到已退役生成内容 | 恢复项目既定边界，内容域描述固定为“公共资源、公告、分类与标签”，不重新暴露生成库 |
| 公共资源合同用跨文件贪婪正则误把后续 ComfyUI `minmax(220px)` 当成资源卡片样式 | 将否定断言收紧到 `.admin-public-resources-grid` 自身规则块，保留固定 250px 卡片约束 |
| 通用组件合同仍要求 `main.tsx` 直接 import，且未识别可扩展 className | 改为验证新的 shell band 消费链，并接受 `tableWrapClassName`、`bodyClassName` 的稳定默认类 |
| 只读面板合同未接受路由级动态 import | 保留模块导出与页面内容断言，将消费方式扩展为静态或动态 import |
| Overview / Tasks 面板合同未接受路由级动态 import | 两个合同同步接受动态 import，仍验证模块拆分、类型与业务行为 |
| `verify:admin-session-governance` 连接本地 `127.0.0.1:18200` 失败 | 该脚本是需要运行中 API 和测试账号的破坏性会话撤销集成验证；保留到受控服务/Gray 验证，不归类为静态合同失败 |
| `npm version 0.8.0 --workspaces` 先改了包版本，但旧内部依赖使 npm 尝试访问私有包注册表并返回 404 | 用 `npm pkg set` 将全部 `@xinghuan/*` workspace 依赖同步到 0.8.0，再由 `npm install --package-lock-only` 正常重建 lockfile |
| 首次 Gray 严格 verify 遇到瞬时 SSH `Connection closed` | 保持 release 不变重试同一只读验证命令，API、Worker、状态与 readiness 全部通过 |
| 复用现有 Gray 登录态 Chrome 标签时浏览器控制通道超时并重置 | 不伪造线上 UI 结论；保留本地完整深链 QA 与 Gray 严格运行态证据，在线登录态截图列为非阻断说明 |
