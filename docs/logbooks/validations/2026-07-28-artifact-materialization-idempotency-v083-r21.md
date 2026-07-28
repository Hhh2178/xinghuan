# Artifact Materialization Idempotency 验证（0.8.3-r21）

## 稳定性行为

- 同一任务的进度物料化、最终物料化和租约接管后的重复回传由 Postgres advisory lock 串行化。
- 主键冲突先按确定性 artifact id 幂等更新；历史记录的 dedupe key 或媒体扩展不一致时，在 savepoint 内按 owner/dedupe key 回退，不再把约束错误作为任务失败。
- 已落盘的部分图片在后续供应商轮询超时后仍保留在生成素材表中。

## 证据

- 本地 `output-materials`、生成进度物料化、图片批处理测试：22/22 通过；Worker/Web type-check 通过。
- 灰度端 r21 部署与严格运行态验证通过：API/Worker active，内部/公网为 `0.8.3 / gray`，permission mode 为 `enforced`。
- 付费灰度批次 `task-1785205857894-2jv8qb` 回传 3 张图片并登记 3 条 active artifact；第 4 张因 `google gemini timeout` 上游轮询超时，未出现此前的 `xh_generation_artifacts_pkey` 冲突。
- Production 继续保持 `v0.7.17`，本轮未部署。
