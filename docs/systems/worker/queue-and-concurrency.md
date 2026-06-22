# Worker 队列与并发

## 当前并发模型

- 普通 Provider 任务按能力类别拆队列
- RunningHub 按平台窗口独立治理
- Worker 运行态会把实际槽位上报到 Redis

## 当前高频能力

- `image / audio / video` 按类别并发
- 用户级窗口与平台级窗口分开
- `/api/admin/system` 可同时看到配置值与实际生效值

## 当前关键文件

- `apps/worker/src/worker.ts`
- `packages/shared/src/task-queue-settings.ts`

## 典型排障

### 后台配置改了但任务还在排队

先检查：

1. `/api/admin/system` 返回的 `effectiveConcurrency`
2. Worker runtime key 是否存在
3. 是否误落到 RunningHub 平台窗口限制
