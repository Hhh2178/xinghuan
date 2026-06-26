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
