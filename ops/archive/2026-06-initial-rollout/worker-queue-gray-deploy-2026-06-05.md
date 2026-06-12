# Redis/worker 任务队列灰度部署记录 - 2026-06-05

## 目标

- 让后台任务从静态记录升级为真实队列闭环。
- API 创建 queued 任务后写入 Redis 队列。
- worker 常驻领取任务，回写 PostgreSQL 状态和日志。
- 后台系统页展示 Redis 状态和队列深度。

## Release

- Release ID: `20260605-1505-xinghuan-worker-queue-gray`
- API 服务: `xinghuan-canvas-next.service`
- Worker 服务: `xinghuan-canvas-next-worker.service`
- Redis: `127.0.0.1:6379`
- 队列名: `xinghuan:tasks`
- 存储驱动: `postgres`

## 变更范围

- `apps/api` 新增 Redis 客户端、任务入队和 Redis 状态探测。
- `/api/admin/system` 新增 `redis` 状态对象。
- 后台系统页展示 Redis 状态、队列名、队列深度和错误。
- 后台任务创建和重排会写入 Redis 队列。
- `apps/worker` 从占位服务升级为 Redis 队列消费者。
- worker 领取任务后回写 `running`、`succeeded` 或 `failed`。
- 新增 `scripts/verify-worker-queue.mjs` 和 `npm run verify:worker`。
- `build:single-port` 纳入 `@xinghuan/worker` 构建。
- 新增 systemd 示例 `ops/systemd/xinghuan-canvas-next-worker.service.example`。
- 灰度服务器新增实际 systemd 服务 `xinghuan-canvas-next-worker.service`。

## 验证证据

本机:

- `node --check scripts\verify-worker-queue.mjs` 通过。
- `node --check scripts\verify-single-port.mjs` 通过。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run type-check -w @xinghuan/worker` 通过。
- `npm run build:single-port` 通过，包含 `@xinghuan/worker`。
- 本机无 Redis/file driver 下 `npm run verify:single-port` 通过。

服务器:

- Redis 服务为 `active`，`redis-cli -h 127.0.0.1 ping` 返回 `PONG`。
- `npm ci` 通过，0 vulnerabilities。
- `npm run build:single-port` 通过。
- `apps/worker/dist/worker.js` 存在。
- `xinghuan-canvas-next.service` 为 `active`。
- `xinghuan-canvas-next-worker.service` 为 `active`。
- `/opt/apps/xinghuan-canvas-next/current` 指向 `20260605-1505-xinghuan-worker-queue-gray`。
- 服务器 `npm run verify:worker` 通过，创建任务后 worker 回写 `succeeded`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`、`databaseStatus=connected`、`redisStatus=connected`、`redisQueue=xinghuan:tasks`、`redisDepth=0`。

## 当前结论

Redis/worker 任务队列已经完成灰度闭环。当前 worker 使用 mock 执行器验证任务状态机，后续 Provider Adapter 接入后会替换执行逻辑，把真实模型调用结果写入任务和素材记录。

## 后续动作

- 实现 Provider Adapter。
- 后台 Provider 增加连接测试。
- worker 根据任务 provider/model 选择 Adapter。
- 任务结果写入输出素材和资源库。
- 增加失败重试、取消检查和任务超时策略。
