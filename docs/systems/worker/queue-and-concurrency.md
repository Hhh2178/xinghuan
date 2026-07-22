# Worker 队列与并发

## 当前并发模型

- 普通 Provider 任务按能力类别拆队列
- RunningHub 按 RH Key 池窗口独立治理
- Worker 运行态会把实际槽位上报到 Redis；key 必须包含 environment namespace，API 只扫描当前环境并按 exact queue 汇总
- RunningHub 任务进入 worker 后，按 `preferredRhKeyId -> 其他 default Key -> 其他启用 Key` 顺序实时尝试抢占
- 只有全部启用 Key 都满载时，才会保留 `rhQueueReason=all_keys_busy` 并继续排队
- 如果 RH Provider 没有任何可用 Key，worker 直接按 `model_config` 失败，不伪装成排队

## 当前高频能力

- `image / audio / video` 按类别并发
- 用户级窗口与平台级窗口分开
- `/api/admin/system` 可同时看到配置值与实际生效值
- RunningHub 总窗口不再手工维护：
  - 自动汇总所有启用 RH Key 的 `maxConcurrency`
  - 占用窗口按 `providerId + keyId` 分开计数
  - 系统页再汇总为 RH 平台当前占用
- Canvas Run 使用 PostgreSQL run 更新时间与 step sequence 做跨运行轮转；每次只领取一个 ready step，再交给现有能力队列，因此不会绕开平台和用户并发窗口。
- `lease_expires_at` 只负责 Coordinator 崩溃接管，Redis 仍只保存队列和短期窗口，不保存 Run 权威状态。

## Canvas Run 公平领取

- `xh_canvas_run_dispatch_cursors` 是 Canvas Run generation 与 quality coordinator 的 owner 轮转权威游标；它不记录任务终态，也不替代租约。
- Worker 在短 PostgreSQL 事务内锁定对应 scope cursor，以 `last_owner_id` 为环状起点选择下一位有 ready work 的 owner，选中 Step 后才更新 cursor。
- 这个顺序只决定哪位 owner 获得下一次 Canvas Run 领取机会；后续仍受现有用户、Provider 和 capability 队列并发窗口约束。

## 当前关键文件

- `apps/worker/src/worker.ts`
- `packages/shared/src/task-queue-settings.ts`

## 典型排障

### 后台配置改了但任务还在排队

先检查：

1. `/api/admin/system` 返回的 `effectiveConcurrency`
2. Worker runtime key 是否存在
   - Gray：只检查 Gray namespace；Production：只检查 Production namespace，禁止使用全局 `KEYS` 混算
3. 是否误落到 RunningHub RH Key 池窗口限制
4. RH Provider 是否真的存在可用 Key，queued 态只看 `preferredRhKeyId`，真正开跑后才会写 `assignedRhKeyId`

## RunningHub 运行态口径

- `queued/submitting` 统一对外显示 `progress=5%`
- `running/polling` 统一对外显示 `progress=45%`
- `succeeded` 统一对外显示 `progress=100%`
- `rhQueueReason=all_keys_busy` 时，queue hint 统一为 `任务队列排队中`
- RH poll heartbeat 至少持续写回：
  - `upstreamTaskId`
  - `runtimeStage=polling`
  - `upstreamStatus`
  - `upstreamMessage`
  - `rhTargetType`
  - `rhRunTargetId`
