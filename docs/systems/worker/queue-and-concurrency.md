# Worker 队列与并发

## 当前并发模型

- 普通 Provider 任务按能力类别拆队列
- RunningHub 按 RH Key 池窗口独立治理
- Worker 运行态会把实际槽位上报到 Redis

## 当前高频能力

- `image / audio / video` 按类别并发
- 用户级窗口与平台级窗口分开
- `/api/admin/system` 可同时看到配置值与实际生效值
- RunningHub 总窗口不再手工维护：
  - 自动汇总所有启用 RH Key 的 `maxConcurrency`
  - 占用窗口按 `providerId + keyId` 分开计数
  - 系统页再汇总为 RH 平台当前占用

## 当前关键文件

- `apps/worker/src/worker.ts`
- `packages/shared/src/task-queue-settings.ts`

## 典型排障

### 后台配置改了但任务还在排队

先检查：

1. `/api/admin/system` 返回的 `effectiveConcurrency`
2. Worker runtime key 是否存在
3. 是否误落到 RunningHub RH Key 池窗口限制
4. RH Provider 是否真的存在可用 Key，且任务是否已经绑定 `assignedRhKeyId`
