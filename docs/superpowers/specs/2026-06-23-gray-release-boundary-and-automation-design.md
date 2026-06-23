# Gray Release Boundary And Automation Design

日期：`2026-06-23`

## 背景

当前灰度发布流程已经具备可执行性，但仍存在三类高频问题：

1. 发布验证职责边界不够清楚，Agent 会把灰度视觉走查和人工体验验证也纳入默认工作，导致耗时拉长，且和用户真实责任混淆。
2. 灰度发布命令链依赖手工拼接，容易受到 PowerShell 转义、远端命令串接和临时顺序差异影响。
3. 发布记录虽然逐步规范，但“代码层已验证”和“待用户视觉验收”还没有形成稳定模板，后续仍容易重复解释。

## 目标

- 明确 Agent 与用户在灰度发布中的职责边界。
- 将灰度发布收敛成“本地准备 -> 灰度部署 -> 运行态校验 -> 用户视觉验收”四段式标准流程。
- 提供可复用脚本和清单，减少命令返工、遗漏和口径漂移。

## 非目标

- 不在本轮引入全自动 CI/CD 流水线。
- 不让 Agent 默认代替用户做灰度视觉验收。
- 不覆盖生产发布流程；本轮先收口灰度。

## 方案概述

采用平衡方案：

1. 规则固化
   - 在 `AGENTS.md` 与 `docs/governance/documentation-governance-standard.md` 中新增“发布验证职责边界”。
   - 约束 Agent 默认只做代码层、架构层和运行态层验证。
   - 约束灰度视觉、交互观感和业务主观体验由用户负责。

2. 脚本标准化
   - 新增 `scripts/release/prepare-gray-release.mjs`
   - 新增 `scripts/release/deploy-gray-release.mjs`
   - 新增 `scripts/release/verify-gray-runtime.mjs`
   - 脚本保持“半自动化”：Agent 能稳定执行，但每一步仍清晰可见、可追溯。

3. 清单与模板
   - 新增 `ops/gray-release-standard-checklist.md`
   - 新增 `ops/templates/gray-release-record-template.md`
   - 更新 `ops/gray-deploy-runbook.md` 与 `ops/gray-acceptance-checklist.md`

## 职责边界设计

### Agent 负责

- 版本推进与版本对齐。
- 本地构建、类型、契约、发布包边界验证。
- 远端部署命令执行、release 切换、服务重启。
- 运行态验证：
  - `current` 指针
  - systemd 服务状态
  - 内网 / 公网 `api/status`
  - 环境名、版本号、数据库目标等结构化结果
- 发布证据与主入口同步。

### 用户负责

- 灰度环境的视觉验收。
- 真实业务链路的人体感知验证。
- 页面布局、文案观感、交互细节是否符合预期。
- 业务输出结果的最终确认与放行判断。

### Agent 默认不做

- 灰度页面视觉对比。
- UI 观感主观判断。
- 业务结果“好不好看 / 是否符合创作预期”的最后结论。

除非用户显式要求，否则这些不进入 Agent 的默认发布责任。

## 脚本设计

### `prepare-gray-release.mjs`

职责：

- 校验工作树状态与版本参数。
- 执行发布前必要验证命令。
- 调用已有 `package-release.mjs` 生成 release 包。
- 输出结构化 JSON，作为后续部署脚本输入。

约束：

- 不做远端部署。
- 不做视觉验收。
- 允许通过参数裁剪验证集，适配不同批次发布。

### `deploy-gray-release.mjs`

职责：

- 上传 release 包到服务器。
- 在远端创建 release 目录并解压。
- 执行 `npm ci`。
- 切换 `current`。
- 重启 `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service`。

约束：

- 不做批量删除。
- 通过参数或环境变量接收 `ssh key / host / port / user / release id / archive path`。
- 默认输出详细步骤，便于追溯。

### `verify-gray-runtime.mjs`

职责：

- 验证远端 `current` 指针。
- 验证服务状态。
- 验证内网与公网 `api/status`。
- 输出结构化 JSON 结果，标识哪些项通过、哪些项待人工确认。

约束：

- 不打开浏览器做视觉验收。
- 不擅自判定 UI 层“已验收”。

## 文档与模板设计

### `ops/gray-release-standard-checklist.md`

拆成两段：

- Agent 必做检查
- 用户必做验收

目的不是复制 runbook，而是形成稳定的责任分工清单。

### `ops/templates/gray-release-record-template.md`

固定记录结构：

- 发布目标
- 版本 / release id
- Agent 已验证项
- 用户待验证项
- 风险 / 残留问题
- 回滚信息

## 兼容与迁移

- 现有 `ops/gray-deploy-runbook.md` 保留，但要补“推荐优先走新脚本”说明。
- `ops/gray-acceptance-checklist.md` 继续保留为兼容清单，但其“视觉层”要明确为用户负责。
- 旧发布记录不强制重写；从新批次开始逐步采用新模板口径。

## 风险与控制

1. 脚本过度自动化风险
   - 控制：只做到半自动化，不隐藏关键步骤。

2. 参数散落风险
   - 控制：脚本统一支持命令行参数和环境变量，并在文档里给出标准例子。

3. 职责边界再次漂移
   - 控制：把规则同时写进 `AGENTS.md` 和治理规范，而不是只放在一次性 release 记录里。

## 成功标准

- 后续灰度发布时，Agent 不再默认执行视觉验收。
- 发布步骤可通过三段脚本串起，减少临时命令返工。
- 发布报告可以稳定输出“Agent 已验 / 用户待验”两部分。
- 主入口与运维文档中对该流程的描述保持一致。
