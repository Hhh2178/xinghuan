# 文档治理正式规范

生效日期：`2026-06-23`

适用范围：`D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

## 目标

本规范用于把当前工程的文档治理收敛成一套稳定、可执行、可验证的规则，解决以下问题：

- 主入口长期堆积历史正文，恢复上下文成本过高。
- 同一事实散落在多处，没有清晰的主记录。
- 台账、长期记忆、系统知识、运维记录之间职责交叉。
- 灰度 / 生产 / 本地 / 历史材料混挂在同一层入口，值守判断容易失真。

本规范采用平衡方案：

- 建立强约束的落点和更新规则。
- 保留兼容入口，但兼容入口只做摘要和跳转。
- 不要求一次性重写全部旧材料，而是持续迁移、持续瘦身。

## 文档层级

### 1. 根入口层

- `AGENTS.md`
  - 作用：项目定位、协作方式、主入口顺序、更新义务、归档规则。
  - 不承接长历史正文。
- `README.md`
  - 作用：当前工作根状态摘要和第一跳入口。
  - 不承接逐日流水。
- `MEMORY.md`
  - 作用：长期记忆兼容入口。
  - 只保留摘要、主题入口、最近 release 入口。
- `DEVLOG.md`
  - 作用：开发台账兼容入口。
  - 只保留模板、规则和当前月入口。
- `ops/README.md`
  - 作用：运维兼容入口。
  - 只保留当前运行态摘要、`current/` 入口和 `archive/` 入口。

### 2. 治理层

- `docs/governance/`
  - 作用：协作规则、入口顺序、归档政策、仓库导航方法、模板。
  - 当前正式规范以本目录为准。

### 3. 系统知识层

- `docs/systems/`
  - 作用：按系统沉淀协议、接口、数据流、执行链和运行规则。
  - 所有“系统现在如何工作”的长期知识优先写这里。

### 4. 长期记忆层

- `docs/memory/`
  - 作用：跨会话仍成立的长期判断、决策、部署结论和主题历史。
  - 与 `MEMORY.md` 的关系是“主题正文”与“兼容入口”。

### 5. 台账与证据层

- `docs/logbooks/daily/`
  - 作用：逐日推进。
- `docs/logbooks/releases/`
  - 作用：当前和历史发布记录索引。
- `docs/logbooks/validations/`
  - 作用：专项验证与验收。
- `docs/logbooks/incidents/`
  - 作用：事故、回滚、线上问题闭环。

### 6. 设计与演进层

- `docs/records/`
  - 作用：长期保留的设计演进记录。
- `docs/superpowers/specs/`
  - 作用：会话内设计文档兼容层。
- `docs/superpowers/plans/`
  - 作用：实施计划兼容层。

## 主记录原则

同一类信息必须有且只有一个主落点：

- 当前状态：`README.md`、`MEMORY.md`、`docs/prd/README.md`、`ops/README.md`
- 系统工作方式：`docs/systems/`
- 长期判断与阶段结论：`docs/memory/`
- 每天做了什么：`docs/logbooks/daily/`
- 某次发布 / 验证 / 事故：`docs/logbooks/releases/`、`docs/logbooks/validations/`、`docs/logbooks/incidents/`
- 协作和归档规则：`docs/governance/`

如果某个事实已经有主记录，其他入口只能做摘要引用，不能再复制成长正文。

## 更新规则

## 工程文件治理规则

从 `2026-06-23` 起，工程文件治理增加以下强约束：

### 1. 超级文件止血

- 不允许继续默认把新功能直接堆进 `server.ts`、`worker.ts`、大型节点组件或大型后台页面。
- 当文件同时承载以下三类及以上职责时，必须优先拆分：
  - orchestration / 路由入口
  - 协议解析或 provider 适配
  - 状态归一化或错误诊断
  - UI 结构与交互状态
  - 数据获取与副作用
- 当文件已进入明显过载区时，本轮真实改动必须同步写明“新增逻辑落在哪个子模块”，不能继续只补在主文件上。
- 第一批热点预算现在已经有对应脚本：
  - `npm run verify:file-hotspot-budgets`
- 预算正文见 `docs/governance/engineering-guardrails.md`
- 除了硬预算热点外，`apps/`、`packages/`、`scripts/` 下任何达到 `1200+` 行的 source 文件，都必须进入超级文件拆分台账：
  - `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
  - 对应脚本：
    - `npm run verify:hotspot-watchlist-contract`
  - 没有入册、没有下一步拆分方向的 `1200+` 文件，不允许默默留在仓库里继续增长
- 当前还新增了一层提交前快检：
  - `.githooks/pre-commit`
  - `npm run verify:hotspot-doc-sync-staged`
- 只要 staged 改动触碰了硬预算热点或 `1200+` watchlist 文件，同一次提交里就必须同步 staged 对应台账 / 计划 / 发布记录之一，不能只改过载文件不留任何结构说明

### 2. 模块落点优先级

- 协议执行逻辑优先落到 `client` 或 adapter 文件。
- 调度与并发优先落到 `dispatch` / `queue` 模块。
- 统一错误、取消、运行态归一化优先落到 `diagnostics` / `cancel-sync` helper。
- 大型前端节点或后台页优先拆 `hooks`、`sections`、`services`，不要把 UI、请求和状态机继续堆在单组件里。

### 3. 工作树整洁规则

- 开工前先看 `git status`，确认当前脏改动是否与本轮任务相关。
- 本轮提交前，工作树只允许保留：
  - 本轮预期改动
  - 明确标记为后续继续处理的增量
- 不允许把无关探索、临时脚本、半成品测试、重复文档长期遗留在工作树里。
- 发布、灰度、正式切换前，必须再次核对 `git status` 与 `git diff --stat`，确认没有把无关改动一起带入。
- gray 部署脚本当前已经接入：
  - `npm run verify:release-worktree-clean`
- 这条检查未通过时，不允许继续进入远端部署动作。
- 发布完成后，必须同步补齐值守索引和发布证据：
  - `docs/logbooks/releases/current-release-index.md`
  - 对应批次的 `docs/logbooks/releases/gray/` 或 `production/` 记录
  - `ops/README.md` 中当前运行态摘要
- 运行产物目录与发布文档目录不能混淆：
  - 根目录 `releases/` 属于忽略的运行产物目录
  - `docs/logbooks/releases/` 属于可提交的证据目录

### 4. 文档先行收口

- 当发现超级文件或跨层热点继续增长时，必须同步更新：
  - `AGENTS.md`
  - 对应 `docs/systems/<system>/README.md`
  - 当日日台账
- 需要拆分但暂时无法在本轮完成时，必须把缺口明确记录到系统文档或审查记录中，不能只留在聊天里。

## 发布验证职责边界

从 `2026-06-23` 起，发布验证必须拆分为两层记录：

### 1. Agent 已验证

- 版本推进与版本对齐
- 构建、类型、契约、发布包校验
- 远端部署与服务重启
- 运行态核验：
  - `current` 指针
  - systemd 服务状态
  - 内网 / 公网接口返回
  - 环境名、版本号、数据库目标等结构化结果
- 发布文档、运维入口和主入口同步

### 2. 待用户验收

- 灰度 / 生产页面视觉观感
- 交互细节与体验判断
- 真实业务链路的人体感知验证
- 输出结果是否符合业务预期的最终确认

规则要求：

- Agent 默认只承担第 1 类验证。
- 第 2 类验证默认由用户承担，除非用户单独要求 Agent 参与。
- 发布记录和总结中必须明确标注：
  - 哪些是 `Agent 已验证`
  - 哪些是 `待用户验收`
- 不允许把仅完成运行态验证的发布写成“完整验收通过”。

### 发生代码实现时

至少更新：

- `docs/logbooks/daily/YYYY/YYYY-MM/YYYY-MM-DD.md`
- 相关系统知识：`docs/systems/<system>/`
- 如结论进入长期层，再更新 `docs/memory/`

### 发生本地验收时

至少更新：

- 当日日台账
- 对应 `docs/logbooks/validations/` 或兼容验证记录

### 发生灰度 / 生产发布时

至少更新：

- 当日日台账
- `docs/logbooks/releases/current-release-index.md`
- 对应 release 记录
- `ops/current/gray.md` 或 `ops/current/production.md`
- 如当前基线变化，再更新 `README.md`、`MEMORY.md`、`ops/README.md`

### 发生阶段口径变化时

必须同轮检查：

- `AGENTS.md`
- `README.md`
- `MEMORY.md`
- `docs/prd/README.md`
- `ops/README.md`

任意一处仍停留旧口径，则该轮文档收尾不算完成。

## 兼容入口规则

以下文件必须长期保持“摘要 + 跳转”，禁止重新堆长正文：

- `MEMORY.md`
- `DEVLOG.md`
- `ops/README.md`
- `docs/documentation-governance.md`

兼容入口允许写：

- 当前用途说明
- 推荐阅读顺序
- 跳转到新目录的索引

兼容入口禁止写：

- 新增长历史正文
- 大段逐日流水
- 已迁移主题的重复全文

## current / archive 规则

### 运维层

- `ops/current/`
  - 只保留当前值守最常用的运行态入口。
- `ops/archive/`
  - 存放已脱离当前值守职责，但仍需保留为审计证据的历史材料。

### 判定标准

保留在 `current/`：

- 当前 active release 仍直接依赖的 runbook、checklist、rollback、release 记录。

移入 `archive/`：

- 已被新 release 覆盖的旧阶段记录。
- 只用于追溯历史，不再用于当前值守的材料。

## 日台账规则

- 月目录：`docs/logbooks/daily/YYYY/YYYY-MM/`
- 每日文件：`YYYY-MM-DD.md`
- 月 README 负责当前月索引，不负责承接逐日正文。
- `recent-highlights.md` 负责当前月高频恢复入口。
- 不再继续把新推进堆回单个 `DEVLOG.md`。

## 命名规则

- 日台账：`YYYY-MM-DD.md`
- 发布记录：`YYYY-MM-DD-<topic>.md` 或兼容既有 release 命名
- 验证记录：`YYYY-MM-DD-<topic>.md`
- 事故记录：`YYYY-MM-DD-<topic>.md`
- 治理规范：`<topic>-standard.md`

命名优先可读和可检索，不为了“统一格式”强行重命名已有稳定历史文件。

## 发布包规则

如果某份文档需要随灰度 / 生产 release 一起落到服务器 release 目录，它必须进入发布包清单。

当前最低要求：

- `AGENTS.md`
- `MEMORY.md`
- `DEVLOG.md`
- `docs/INDEX.md`
- `docs/governance/`

否则“已发灰度，但服务器 release 不包含对应治理文档”应视为文档发布未真正生效。

## 收尾检查清单

每轮涉及文档治理时，收尾前至少核对：

1. 新规则是否写入 `docs/governance/`
2. 兼容入口是否只保留摘要和跳转
3. `docs/INDEX.md` 是否能跳到新的正式规范
4. `ops/current/` 与 `ops/archive/` 是否边界清楚
5. `codegraph sync` 是否完成
6. `git status` 是否只剩本轮预期改动

## 当前执行结论

从 `2026-06-23` 起，本工程的文档治理正式以本文件为准。

旧文件的角色统一变为：

- 兼容入口
- 历史正文
- 迁移承接层

新的治理增量一律优先进入 `docs/governance/`，而不是继续回写到旧长文。
