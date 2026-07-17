# Admin 十域信息架构 Gray v0.8.0 验证记录

> **验证范围：** 十域导航、二级页面稳定 URL、按域加载、页面分包、错误隔离、视觉/动效合同与 Gray v0.8.0。
> **证据类型：** 本地自动验证与 Playwright mock-auth 页面验证。
> **当前结论：** 本地实现、Harness、Gray 部署和严格运行态验证均通过；线上登录态浏览器控制超时，未将其记作页面验收通过。

## 2026-07-17

- 已读取工作区与项目规则。
- 已确认项目当前仅有一个与本任务无关的未跟踪模板脚本，保持不动。
- 已审计后台页面映射、主应用数据加载、用户治理、RunningHub、ComfyUI 与既有设计文档。
- 已与用户确认第五个一级业务域为“RH 管理”，ComfyUI 独立为一级业务域。
- 已创建文件化规划记录。
- 已完成正式总计划文件，覆盖十大业务域、页面树、路由、视觉 Token、组件、动效、可访问性、数据加载、权限、安全、迁移阶段和验收标准。
- 已完成规划文件结构与 Git 差异检查，未修改后台业务代码。
- 用户已授权开始实施；当前进入 I0 基线与兼容映射阶段。
- CodeGraph 索引健康且已是最新状态。
- 已确认 Phase 1 的最小安全切口：十域声明模型 + URL 同步 + 旧页面兼容映射。
- 已实现十域数据模型、路径解析、History API 导航和用户/安全域初始视图适配。
- Admin TypeScript 检查通过；首次合同运行发现旧预期遗漏 ComfyUI，已修正。
- 已通过 Playwright mock-auth 浏览器验收：十域均可见，RH 跳转到 `/admin/rh`，权限与安全跳转到 `/admin/security` 并默认打开权限视图，浏览器后退恢复 `/admin/rh`。
- 浏览器截图确认 1440×1000 下十域导航完整可见；mock 环境的 API 错误来自未模拟业务接口，不是本次导航实现错误。
- 最终通过 Admin view-model、Starlight shell、Users panel、interaction guards 四组合同。
- Admin 生产构建通过；Vite 仅保留既有主包超过 500 kB 的警告，后续路由级懒加载批次处理。
- CodeGraph 已同步并确认索引最新。
- 已完成账号/组织/权限、Provider/模型、RH 工作流/应用/Key 池、用量/审计、系统健康/运行参数/环境同步的独立路由。
- ComfyUI 实例详情已支持 `config / workflows / logs` 稳定子视图 URL；遵循冻结约束，不新增后端能力。
- 页面组件已改为动态 import，Admin 生产构建主壳由约 534 kB 降至约 261 kB，其余业务域形成独立 chunk。
- 已加入页面级错误边界、统一焦点态、100/180/240ms 动效 Token 与减少动画规则。
- Admin 静态合同全套通过；需要运行中 API 的会话撤销脚本留到受控运行态，不在本地无服务环境伪造通过。
- `npm run harness:verify:project` 与 `npm run harness:verify:workspace` 通过。
- Playwright mock-auth 在 1440×1000 下确认十域完整；`/admin/capabilities/models`、`/admin/rh/keys`、`/admin/system/runtime-settings` 深链及前进/后退恢复通过。
- 浏览器控制台中唯一 404 来自 mock 未配置 `/api/admin/system`；路由、页面标题、二级导航和错误隔离均正常。
- 发布版本确定为 `v0.8.0`，反映本次用户可见的信息架构升级。
- Push Hook 完成 45 个测试文件、163 项测试、全部 workspace type-check 与生产构建。
- Gray prepare、deploy 和两次 verify 已完成；首次严格 verify 遇到一次瞬时 SSH 断开，原命令重试后完整通过。
- release symlink 为 `/opt/apps/xinghuan-canvas-next/releases/20260717-admin-ten-domain-gray-r1-v080`。
- API / Worker 均为 `active`；内网和公网状态均为 `0.8.0 / gray / enforced`。
- 权限 readiness 为 `ready=true`：127 Subjects、121 published、3 restricted、3 retired、926 rules、5 principals、0 failures。
- 数据库迁移为 `applied: 0 / skipped: 23`，本批次无 schema 与数据写入变更。
- 尝试复用现有 Gray 登录态 Chrome 标签进行线上 UI 复核时，浏览器控制通道在页面导航阶段超时并重置；因此本记录只认定本地完整 UI 与 Gray 运行态通过，不声称新的线上登录页面截图通过。

## 已通过命令

- `npm run verify:admin-view-model-contract`
- `npm run verify:admin-starlight-shell`
- `npm run verify:admin-users-panel-contract`
- `npm run verify:admin-interaction-guards`
- `npm run build -w @xinghuan/admin`
- `codegraph sync`
- `npm run harness:verify:project`
- `npm run harness:verify:workspace`
- `npm run verify:admin-resource-content-phase2`
- `npm run verify:admin-common-components-contract`
- `npm run verify:admin-readonly-panels-contract`
- `npm run verify:admin-overview-panel-contract`
- `npm run verify:admin-task-panel-contract`
- Playwright CLI deep-link QA (`1440x1000`)
- `npm run release:gray:prepare -- --release=20260717-admin-ten-domain-gray-r1-v080`
- `npm run release:gray:deploy -- --env=gray --release=20260717-admin-ten-domain-gray-r1-v080 --archive=dist-release/20260717-admin-ten-domain-gray-r1-v080.tar.gz --ssh-key=<local-key-path>`
- `npm run release:gray:verify -- --env=gray --release=20260717-admin-ten-domain-gray-r1-v080 --strict --ssh-key=<local-key-path>`

## 非阻断说明

- `verify:admin-session-governance` 是需要运行中 API 与测试账号、并会撤销会话的破坏性集成脚本；本地无 API 时连接失败，本批次未在 Gray 真实账号上执行。
- npm audit 仍报告 1 项既有 low 风险依赖问题，不是本次变更新增，也不阻断 Gray。
