# Worker 执行链

## 标准链路

1. 从队列消费任务
2. 判断任务类型
3. 进入普通 Provider 或 RunningHub 分支
4. 提交上游任务
5. 轮询或查询结果
6. 回写任务状态和输出
7. 产出可供前端消费的结果

## 当前重点分支

- 普通 Provider 图像/视频/音频
- RunningHub Workflow
- RunningHub AI App

## 排障第一跳

- 任务排错分支：`apps/worker/src/worker.ts`
- 输出落库异常：`apps/worker/src/output-materials.ts`
