# AIFork Grok FAST 三图预处理真实验收

## 验收参数

- 三张原始 PNG 参考图
- 模型：`grok-imagine-video-1.5-fast`
- 6 秒、9:16、720p
- 提示词：`她跳桑巴舞`
- 只允许一次生成 POST

## 发布前验证

- 公网签名 URL 与 Data URL 均进入同一 JPEG 预处理。
- 样例 `941x1672 PNG` 输出为 `576x1024 JPEG`。
- 三张真实素材原始大小为 `2,048,315 / 1,961,434 / 1,883,290 bytes`，处理后为 `74,949 / 66,212 / 59,833 bytes`。
- 三张处理后总载荷为 `200,994 bytes`，尺寸均为 `576x1024`。
- 精确 FAST 请求契约、Provider 入队、Worker 和最终 content 回收回归通过。
- 全量 71 项测试与类型检查通过。

## 灰度真实结果

- 画布任务 ID：`task-1784115349403-hjt1zu`。
- 上游任务 ID：`task_yJmBoI01zJNsHDKEwha3maoJEmadrEkj`。
- 生成 POST 次数：`1`；该任务创建时间之后同模型任务计数为 `1`。
- 实际请求摘要：`duration=6`、`ratio=9:16`、`imageCount=3`、`requestContractEnabled=true`。
- 压缩后参考图载荷：`268,065` 个 Data URL 字符，对应三张 JPEG 原始字节总计 `200,994 bytes`。
- 最终状态：`succeeded / completed / 100%`。
- 输出物料：`resourceCount=1`、`videoCount=1`、资源 ID `res-1784115427420-a8gspj`。
- 本地输出：`/files/output/task_output_task-1784115349403-hjt1zu_1.mp4`。
- 视频参数：H.264、`720x1280`、24 fps、`6.041667s`、`3,588,120 bytes`，包含 AAC 音轨。
- 画布回收：任务运行时由“轮询中”切换为“已完成 100%”，不再持续轮询；刷新后任务终态卡片不保留展示，但本地输出物料和资源记录已持久化。

## 结论

- 原始三图场景不再出现 `Video input reference 3 ... 403`。
- FAST 字段契约、三图预处理、任务终态、视频下载、本地物料化与画布轮询停止均通过真实验收。
