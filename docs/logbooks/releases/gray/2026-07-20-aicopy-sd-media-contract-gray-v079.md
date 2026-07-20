# AICOPY SD 混合媒体契约 Gray v0.7.9 发布

- release：`20260720-aicopy-sd-media-contract-gray-r1-v079`
- source commit：待提交后填写
- 制品：`dist-release/20260720-aicopy-sd-media-contract-gray-r1-v079.tar.gz`
- 回滚：`20260720-aicopy-video-contract-scope-gray-r1-v078`

## 变更

- 按次、按秒及渠道 431/900 SD profile 使用各自请求绑定；按次与渠道 431 的图片、视频、音频统一写入结构化 `input.media[]`。
- 参考视频从画布、API 校验、任务 payload、Worker 到 AICOPY adapter 全链路传递；AICOPY 视频模型自动显示对应输入能力。
- 提交前按 UTF-8 字节校验 AICOPY Prompt 的 4096 字节上限，并解包上游嵌套错误，避免把“任务创建前拒绝”误报成不可读的 `fail_to_fetch_task`。
- 本次仅更新 Gray 制品和模型契约模板，不执行 Production 晋级，不执行 Release retention/prune，不删除任何旧 Release。

## 验证

- AICOPY adapter contract：PASS
- AICOPY SD model config：PASS
- video input validation：14 tests PASS
- 完整 type-check/build 与 Gray runtime verify 在发布前执行并记录到验证单。
