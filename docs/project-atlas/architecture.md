# 项目结构与架构总览

## Monorepo 结构

- `apps/web`
  - 用户画布前端，负责节点编辑、项目读写、素材空间、生成节点消费
- `apps/admin`
  - 后台管理端，负责用户、Provider、模型、任务、系统观测、助手配置
- `apps/api`
  - 单端口 API 服务，承载认证、画布、资源、后台、生成代理、任务调度入口
- `apps/worker`
  - 异步任务执行器，负责队列消费、上游轮询、输出素材落库、任务状态推进
- `packages/shared`
  - 共享类型、常量和基础工具
- `packages/canvas-core`
  - 画布和节点相关核心结构
- `packages/model-core`
  - 模型能力、参数 schema、输入 profile 等底层建模
- `packages/ui`
  - 共享 UI 组件和通用展示层
- `scripts`
  - 构建、打包、验收、发布、迁移、维护脚本

## 运行架构

当前项目采用前后端与 worker 分离、但同仓库推进的结构：

- `web/admin` 先打包为静态产物
- `api` 提供统一 HTTP 入口
- `worker` 通过 Redis 队列消费异步任务
- `postgres` 承载正式存储
- `files` / 本地共享目录承载输入输出素材

## 核心边界

- 画布前端不直接理解上游服务商协议，只消费后台发布的 Provider / 模型目录
- 生成节点不按“一个服务商一个节点”扩展，而是按通用节点 + 模型目录 + schema 驱动
- 后台不挂在画布抽屉里，而是独立管理端
- 任务状态、取消、重试、输出落库由 API + Worker 共同完成，不放在前端本地拼装

## 当前高频链路

1. 用户在 `apps/web` 选择模型并提交生成
2. `apps/api` 校验会话、整理 payload、写入任务
3. `apps/worker` 消费队列并调用外部 Provider
4. 结果落库到任务表和素材访问层
5. `apps/web` / `apps/admin` 通过任务和素材接口回读结果

## 文档对应关系

- 产品版本和范围：`docs/prd/v0.1.0/*`
- 部署与验收：`ops/*`
- 长期状态：`MEMORY.md`
- 逐日推进：`DEVLOG.md`

## 不该混进结构认知的目录

以下目录属于运行产物或本机辅助目录，不作为架构入口：

- `output/`
- `releases/`
- `dist-release/`
- `logs/`
- `.tmp/`
- `.codex-temp/`
- `.codegraph/`
- `.playwright-cli/`
