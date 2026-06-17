# 文档治理与归档规范

## 目标

本规范用于解决以下长期问题：

- 项目状态已经推进，但入口文档仍停留在旧阶段。
- 同一件事同时写在多个文件里，却没有明确“哪份是主记录”。
- 历史记录仍挂在主入口，后续恢复上下文时需要人工猜哪份才是最新。
- 验证、发布、灰度、正式和本地结论混写，导致后续放行判断困难。

本规范的目标是：

- 让“当前状态”只在少数主入口里维护。
- 让“历史证据”保留，但不再占据当前入口。
- 让每次真实推进都知道应该更新哪些文件。
- 让后续恢复上下文时先看入口索引，不再依赖全文搜索和日志顶部猜状态。

## 文档分层

### 1. 根入口层

- `README.md`
  - 作用：告诉协作者当前工作根、主要入口和当前高层状态。
  - 允许写入：当前版本、当前灰度/生产域名、当前 release、当前阶段总结、入口链接。
  - 不允许写入：详细变更清单、逐日发布细节、长篇历史记录。

- `AGENTS.md`
  - 作用：约束协作方式、文档路由、更新义务、归档边界。
  - 允许写入：规则、入口顺序、主记录位置、更新时机。
  - 不允许写入：长篇运行历史、一次性验收细节。

- `MEMORY.md`
  - 作用：保留长期有效且跨多次会话仍成立的项目记忆。
  - 允许写入：当前阶段、当前 release、关键部署状态、长期决策、长期风险结论。
  - 不允许写入：纯当天推进流水、短期调试细节、重复的发布流水。

### 1.5 项目总纲层

- `docs/project-atlas/README.md`
  - 作用：作为 AI 与协作者的第一跳总纲入口，告诉读者结构、环境、接口、排障和台账规则分别看哪份。
- `docs/project-atlas/architecture.md`
- `docs/project-atlas/runtime-and-env.md`
- `docs/project-atlas/interfaces-and-dataflow.md`
- `docs/project-atlas/debugging-playbook.md`
- `docs/project-atlas/logbook-maintenance.md`
- `docs/project-atlas/document-routing-and-cleanliness.md`
  - 这些文件只保留长期有效、高频复用的结构化知识，不承接逐日流水或单次发布命令记录。

### 2. 产品文档层

- `docs/prd/README.md`
  - 作用：产品文档索引和当前版本状态摘要。
  - 只维护当前活跃版本与推荐阅读顺序。

- `docs/prd/v0.1.0/progress.md`
  - 作用：当前活跃版本的产品推进状态。
  - 允许写入：当前版本层面的阶段结论、关键能力完成情况、与产品能力直接相关的验收状态。
  - 不允许写入：与版本状态无关的长篇历史流水。

- `docs/prd/v0.1.0/changelog.md`
  - 作用：按日期记录版本内的主要变更。
  - 保持按时间追加，不承担唯一入口摘要职责。

- `docs/prd/v0.1.0/release.md`
  - 作用：描述该版本范围、验收边界和发布结论。
  - 如 release 状态明显发生变更，应同步更新“当前 release 基线”和结论。

### 3. 治理与专项方案层

- `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - 作用：正式化治理的主方案。
  - 维护 `Phase A-E` 的目标、完成标准和当前状态。

- `docs/quality-audit-phase-d-2026-06-15.md`
  - 作用：专项质量审计和阶段性检测报告。
  - 这类文件保留审计结论，不承担主入口职责。

- `docs/size-audit-2026-06-15.md`
  - 作用：记录仓库体积基线、主要占用来源和后续瘦身顺序。
  - 这类文件用于辅助仓库治理和清理判断，不承担产品状态主入口职责。

### 4. 运维与验收层

- `ops/README.md`
  - 作用：当前运行态运维索引、当前灰度/正式材料入口、归档批次索引。
  - 这里必须区分：
    - 当前运行态入口
    - 当前放行材料
    - 已归档历史材料

- `ops/*.md`
  - 作用：保留灰度、正式、回滚、验收、部署和专项记录。
  - 原则：完成且被后续阶段覆盖的材料，应迁到 `ops/archive/`，不要长期挂在主入口。

- `ops/archive/`
  - 作用：保留历史审计证据。
  - 归档后不删除、不改写内容，必要时只补充归档索引。

### 5. 过程资料层

- `development/README.md`
  - 作用：管理候选方案、草稿和过程资料。
  - 明确哪些资料仍活跃，哪些应移入 `_archive/`。

## 当前状态只写在哪些文件

以下信息必须以这些文件为准：

- 当前 worktree 与工作入口：
  - `README.md`
  - `AGENTS.md`
  - `docs/repo-structure.md`

- 当前高层项目状态：
  - `README.md`
  - `MEMORY.md`
  - `docs/prd/README.md`

- 当前项目结构、运行环境、接口、排障与台账规范：
  - `docs/project-atlas/README.md`
  - `docs/project-atlas/*.md`

- 当前产品版本推进状态：
  - `docs/prd/v0.1.0/progress.md`

- 当前多用户正式化治理阶段：
  - `MEMORY.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`

- 当前灰度/生产 release 和运行服务状态：
  - `MEMORY.md`
  - `ops/README.md`
  - 对应的 `ops/*release*.md`

## 每次真实推进后的最低更新清单

当发生以下事件时，至少要同步这些文件：

### 代码实现完成

- `DEVLOG.md`
- 当前版本 `progress.md` 或 `changelog.md`
- 如结构、环境、接口或排障路径变化，还要更新：
  - `docs/project-atlas/README.md`
  - 对应分域手册
- 如阶段结论变化，还要更新：
  - `MEMORY.md`
  - `docs/prd/README.md`

### 本地验收完成

- `DEVLOG.md`
- 对应专项记录（如 `ops/phase-d-local-validation-*.md`）
- 如阶段结论变化，还要更新：
  - `MEMORY.md`
  - `docs/production-multi-user-hardening-plan-*.md`

### 灰度发布完成

- `DEVLOG.md`
- 对应灰度发布记录 `ops/*gray*.md`
- `ops/README.md`
- 如当前 release 基线变化：
  - `MEMORY.md`
  - `README.md`

### 正式发布完成

- `DEVLOG.md`
- 对应正式发布记录 `ops/*prod*.md` 或 `ops/*release*.md`
- `ops/README.md`
- 如当前 release 基线变化：
  - `MEMORY.md`
  - `README.md`

### 阶段口径变化

例如：

- `Phase C` 完成并进入 `Phase D`
- `Phase D` 完成本地收口并准备进入 `Phase E`

必须同步：

- `AGENTS.md`
- `README.md`
- `MEMORY.md`
- `docs/prd/README.md`
- `docs/prd/v0.1.0/progress.md`
- `docs/production-multi-user-hardening-plan-2026-06-13.md`

### 运行产物或归档体积显著变化

例如：

- `releases/`、`dist-release/`、`output/` 继续快速增长
- `development/_archive/` 已明显大于当前活跃资料
- 新增了新的本机缓存或审计产物目录

至少要同步检查：

- `docs/runtime-artifacts.md`
- `docs/size-audit-2026-06-15.md`
- `docs/project-atlas/document-routing-and-cleanliness.md`
- `ops/README.md` 或 `development/README.md`（若归档入口发生变化）

### 台账维护方式变化

例如：

- `DEVLOG.md` 模板变化
- gray / prod 发布记录收束方式变化
- changelog 与 ops 的分工变化

至少要同步：

- `docs/project-atlas/logbook-maintenance.md`
- `AGENTS.md`
- `DEVLOG.md`
- `ops/README.md`

## 归档规则

### 必须归档的情况

满足以下任一条件，应从主入口移出并放入归档批次：

- 该记录描述的是已完成且已被后续 release 覆盖的阶段性发布。
- 该记录仍有审计价值，但不再是“当前运行态入口”。
- 该记录的结论已经被更新版本的同类记录替代。
- 该记录继续挂在主入口会误导协作者判断当前 release 或当前阶段。

### 不应归档的情况

- 仍直接用于部署、放行、回滚和值守的当前材料。
- 当前版本唯一的主方案、主结论、主索引。
- 后续仍会反复引用的长期规范。

### 归档操作原则

- 不删除历史证据。
- 优先移动到 `ops/archive/<批次>/` 或 `development/_archive/`。
- 归档后同步更新：
  - `ops/README.md` 或 `development/README.md`
  - `ops/archive/README.md`（如果新增归档批次）

## `ops/README.md` 的维护规则

`ops/README.md` 必须始终拆成三层：

1. 当前状态摘要
2. 当前运行态 / 当前放行入口
3. 历史归档批次

禁止再把所有历史灰度文件平铺在“当前运行态入口”里。

额外要求：

- “当前运行态 / 当前放行入口”只保留当前 active release 仍直接依赖的 runbook、checklist、最新阶段 release、gate、rollback 和最新热补丁记录。
- 同一主题出现新的阶段 release 或新的真实放行记录后，旧记录必须在同一轮推进内判断是否移入 `ops/archive/`，不能长期因为“也许以后还会看”继续挂在当前入口。
- 新增归档批次时，必须同时更新 `ops/archive/README.md`，否则视为归档动作未完成。

建议的判断标准：

- 与当前 active release 和当前阶段直接相关：留在当前入口。
- 只是说明早期阶段完成过什么：移到归档批次。

## `AGENTS.md` 的维护规则

`AGENTS.md` 不再承担详细状态流水职责，重点只保留：

- 项目定位
- 默认查看顺序
- 主入口路由
- 文档更新义务
- 归档规则
- 当前高层阶段结论

如果当前阶段结论发生变化，必须在同一轮真实推进中更新 `AGENTS.md`，不能长期保留旧状态。

## 推荐查看顺序

### 想快速知道“现在做到哪儿了”

1. `README.md`
2. `AGENTS.md`
3. `docs/project-atlas/README.md`
4. `MEMORY.md`
5. `docs/prd/README.md`
6. `ops/README.md`

### 想知道“这一阶段为什么这么判断”

1. `MEMORY.md`
2. `docs/production-multi-user-hardening-plan-2026-06-13.md`
3. `docs/quality-audit-phase-d-2026-06-15.md`
4. `ops/phase-d-local-validation-2026-06-15.md`
5. `DEVLOG.md`

### 想知道“历史上怎么演进到这里”

1. `DEVLOG.md`
2. `docs/prd/v0.1.0/changelog.md`
3. `ops/archive/README.md`

## 当前执行要求

从本次整理开始，后续每次出现以下情况都必须主动检查入口一致性：

- 当前 phase 变化
- 当前 gray/prod release 变化
- 当前 active 版本结论变化
- 主入口新增或归档批次变化

最少需要交叉核对：

- `AGENTS.md`
- `README.md`
- `MEMORY.md`
- `docs/prd/README.md`
- `ops/README.md`

如果这五处里有任何一处仍停留在旧状态，则本轮记录工作视为未完成。
