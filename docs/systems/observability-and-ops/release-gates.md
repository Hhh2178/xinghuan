# Release Gate

## 当前高频 gate

- `verify:release-preflight`
- `verify:request-chain-observability`
- `verify:system-observability`

## 当前重点

- gate 结果要能回写到运行态文档
- 系统页要展示健康、覆盖率和实际生效值

## 旧服务器目标锁定（0.8.3-r1）

Gray 与 Production 发布和运行时验证必须显式传入 `--target-profile=old-server`。该配置唯一允许 `101.33.75.38:728` 上的两套既定根目录、服务、状态地址和数据库名；任何目标覆盖值不一致时必须以 `OLD_SERVER_TARGET_MISMATCH` 失败。`config/environments.json` 中的其他服务器仅供其原有流程使用，不能作为本次 0.8.3 发布默认值。
