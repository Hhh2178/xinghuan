# 架构决策

## 当前稳定决策

### Monorepo 分层

- `apps/web` 负责画布前端
- `apps/admin` 负责后台
- `apps/api` 负责统一 HTTP 入口
- `apps/worker` 负责异步执行
- `packages/*` 负责共享建模与基础能力

### 前后端与 Worker 分离

- API 负责鉴权、提交、聚合与只读信息
- Worker 负责异步任务执行、查询和结果落库

### Provider 体系

- 通用节点消费后台模型目录
- 协议差异优先收口为配置与 adapter，不扩散到前端

### RunningHub 体系

- Workflow 与 AI App 必须按 `kind` 区分
- 条目字段优先由后台管理而不是前端猜

### 文档治理

- 协作从“总纲 -> 索引 -> 系统知识 -> 代码”进入
- 长期记忆、台账、系统知识、记录库分层维护

## 相关入口

- `../systems/api/architecture.md`
- `../systems/worker/execution-chain.md`
- `../systems/providers/protocol-layering.md`
