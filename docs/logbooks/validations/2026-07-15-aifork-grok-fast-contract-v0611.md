# AIFork Grok FAST 三图真实验收

## 目标

- 灰度 `v0.6.11`
- 模型 `grok-imagine-video-1.5-fast`
- 三张参考图、6 秒、9:16、720p
- 只允许一次生成 POST，任务必须成功并回收到画布输出物料

## 发布前结果

- 精确请求体：通过。
- Provider 入队、Worker、最终 content 回收相关回归：通过。
- 全工作区类型检查：通过。
- `build:single-port`：通过。
- Vitest：22 个文件、70 项测试通过。

## 灰度真实结果

- 画布任务 ID：`task-1784112843014-0fe7jg`。
- 上游任务 ID：`task_4Fp4DBYvlFaTdw7Bjx79XGQqeuHd5qRX`。
- 生成 POST 次数：`1`。
- 实际摘要：`duration=6`、`ratio=9:16`、`imageCount=3`、`requestContractEnabled=true`。
- 最终任务状态：`failed`，45%。
- 失败原因：`Video input reference 3 failed: Asset upload returned 403`。
- 结论：字段契约修复生效，但原始 PNG Data URL 未按插件压缩；该批次不满足验收，后续修复进入 `v0.6.12`。
