# DEVLOG.md - 无限画布 2.0 开发日志台账

## 兼容入口说明

`DEVLOG.md` 继续保留为逐日推进台账的兼容入口，但详细正文已拆分到 `docs/logbooks/daily/`。

- 当前总索引：`docs/INDEX.md`
- 当前日常台账目录：`docs/logbooks/daily/`
- 当前发布证据目录：`docs/logbooks/releases/`
- 当前验证记录目录：`docs/logbooks/validations/`

## 最近高频入口

- 当前月份说明：`docs/logbooks/daily/2026/2026-06/README.md`
- 当前月份高频事项：`docs/logbooks/daily/2026/2026-06/recent-highlights.md`
- 当前发布索引：`docs/logbooks/releases/current-release-index.md`
- 当前验证索引：`docs/logbooks/validations/`

## 日志规则

- 最新记录放在对应日期文件顶部。
- 每次真实推进都要记录目标、变更、验证、影响、风险、下一步。
- 长期规则不要只留在日台账，应同步收口到 `MEMORY.md`、`docs/memory/`、`docs/systems/` 或 `ops/`。
- 禁止在台账中记录真实密钥、Cookie、Token、SSH Key 和数据库密码。

## 标准记录模板

```md
## YYYY-MM-DD

### 事项标题

目标:
- 

变更:
- 

验证:
- 

影响:
- 

风险:
- 

下一步:
- 
```

## 历史迁移说明

- `2026-06` 的大段旧正文已拆到 `docs/logbooks/daily/2026/2026-06/`。
- 后续新的逐日推进不再回填到本文件。

## 2026-06-26

### 工作流资源保存后不可见修复

目标:
- 修复“框选节点保存到资源库后，在工作流资源库里看不到”的问题
- 修复 workflow 资源后续插入画布时对 `fileUrl` 的错误强依赖

变更:
- `apps/web/src/services/api.ts` 中的 `getResourceItems` 不再把默认分类态 `all` 当成真实 `categoryId` 发给后端
- `apps/web/src/utils/workflowResource.ts` 新增 `resolveWorkflowResourceFragment`，优先从内嵌 `workflowFragment` 恢复工作流，缺失时才回退到 `fileUrl`
- `apps/web/src/App.tsx` 改为走统一工作流资源解析逻辑
- 新增回归脚本 `scripts/verify-resource-items-query-contract.ts`
- 新增回归脚本 `scripts/verify-workflow-resource-resolver-contract.ts`

验证:
- `npx tsx scripts/verify-resource-items-query-contract.ts`
- `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`
- `npm run type-check -w @xinghuan/web`

影响:
- 资源库“工作流”分类现在可以正常看到刚保存的工作流
- 这类 workflow 资源后续插入画布时不再依赖额外生成 json 文件

风险:
- 仍需你在灰度环境亲测一次“保存工作流到资源库 -> 打开工作流资源库 -> 点击插入”的完整交互

下一步:
- 提交并推送 gray，等待真实画布链路验收

### 旧工作流兼容与资源库可见性修复

目标:
- 修复旧工作流导入后 LLM 节点兼容性问题
- 降低画布刷新后回退风险
- 让工作流资源保存后在资源库中稳定可见

变更:
- 新增 `apps/web/src/utils/nodeMigration.ts`，导入与恢复画布时对旧 `llm` 节点做轻迁移，清理运行态残留字段
- `apps/web/src/components/Canvas.tsx` 与 `apps/web/src/components/canvas/useCanvasPersistence.ts` 接入迁移层
- `apps/api/src/server.ts` 对 workflow 资源项补齐摘要与预览字段，确保资源卡片能稳定展示
- 新增 `docs/records/canvas/2026-06-26-canvas-compatibility-and-persistence-risk-analysis.md`

验证:
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`

影响:
- 旧工作流更容易直接运行
- 资源库中的 workflow 卡片预览和摘要可见性提升

风险:
- 仍需真实导入旧工作流、刷新画布、保存工作流做浏览器验收

下一步:
- 继续做本地浏览器真实验收，并视情况补充更细的节点 schema 迁移
### LLM 导入残留会话状态清理
目标:
- 修复“旧工作流导入后 LLM 节点无法正常使用，复制节点也无效，必须重建节点”的问题
- 让工作流资源库保存/恢复后的 LLM 节点不再携带旧会话和旧输出残留

变更:
- 收紧 `apps/web/src/utils/nodeMigration.ts` 的 `llm` 导入迁移，只保留模型配置与用户输入，清理旧的 `reply / prompt / history / generatedImages / imageUrls / taskRuns` 等残留运行态
- 同步收紧 `apps/api/src/canvas-node-migration.ts`，保证后端保存/恢复画布时与前端迁移口径一致
- 确认 `apps/web/src/utils/workflowResource.ts` 创建与恢复 workflow fragment 时会走模板运行态清理和 `LLM` 导入迁移，避免资源库里的旧工作流再次带回脏状态
- 新增回归脚本 `scripts/verify-llm-import-migration-contract.ts`

验证:
- `npx tsx scripts/verify-llm-import-migration-contract.ts`
- `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/api`
- `codegraph sync`

影响:
- 旧工作流导入、从后端恢复、从资源库插入时，LLM 节点会被还原成“保留配置但不保留旧会话”的干净状态
- 之前因为旧多模态历史和旧输出地址被重复带入而导致的兼容性问题会被收口在迁移层，不需要用户手工重建节点

风险:
- 这次有意不再保留 LLM 节点的历史聊天内容和旧生成结果；如果后续需要“带会话复制/带会话归档”，要设计成显式能力，不能继续复用导入链路

下一步:
- 由你在灰度或当前环境中重点验证“旧工作流导入 / 资源库插入 / 刷新后重新打开画布”这三条链路里的 LLM 节点是否恢复正常
