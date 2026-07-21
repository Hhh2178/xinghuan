# Worker 执行链

## 标准链路

1. 从队列消费任务
2. 判断任务类型
3. 进入普通 Provider 或 RunningHub 分支
4. 提交上游任务
5. 轮询或查询结果
6. 回写任务状态和输出
7. 产出可供前端消费的结果

任务状态写入 `xh_tasks` 后，由数据库费用触发器统一捕获新任务价格快照并结算终态；Worker 不自行计算金额，避免与 API 同步任务或取消路径产生双账。

## 当前重点分支

- 普通 Provider 图像/视频/音频
- RunningHub Workflow
- RunningHub AI App

## 排障第一跳

- 任务排错分支：`apps/worker/src/worker.ts`
- 输出落库异常：`apps/worker/src/output-materials.ts`
