# Release Gate

## 当前高频 gate

- `verify:release-preflight`
- `verify:request-chain-observability`
- `verify:system-observability`

## 当前重点

- gate 结果要能回写到运行态文档
- 系统页要展示健康、覆盖率和实际生效值

## Sealed artifact gates

生产封装必须先通过：

1. `npm run build:production-runtime`，确认 API/Worker/readiness CLI 无 source map 和内部包外部导入。
2. `npm run package:release -- <release-id>`，确认 allowlist、`BUILD-MANIFEST.json` 和相邻 SHA-256 sidecar。
3. `npm run verify:release-package-contract -- --archive=<archive>` 与版本对齐检查，确认禁止项为零。
4. Gray deploy/runtime dry-run，再由 Gray 运行态验证批准 Production 晋级同一 archive；Production 不得重建。

### Server-only encrypted packaging

- 开发仓库继续使用原有 `npm run dev`、`npm run build` 和 TypeScript 源码链路；只有服务器发布显式执行 `npm run package:server-release -- <release-id>` 时才增加加密封装。
- `package:server-release` 先生成无源码、无 source map 的 sealed runtime archive，再使用服务器环境变量 `XINGHUAN_RELEASE_ENCRYPTION_KEY` 生成 AES-256-GCM `.tar.gz.enc` 包和外层 SHA-256 sidecar。
- 加密密钥只存在 Gray/Production 服务器环境文件，不进入 Git、归档、日志、manifest 或聊天；部署脚本收到 `.enc` 时只在服务器临时目录解密，随后删除临时密文、明文归档和解密 helper。
- `npm run verify:encrypted-release-contract -- --archive=<encrypted-archive>` 必须同时验证外层 envelope 和解密后的既有 release package contract；普通 `package:release` 仍保持兼容。

远端安装使用 `npm ci --omit=dev`，readiness 使用编译后的 `apps/api/dist/cli/permission-readiness.js`。归档 hash 记录在 release/validation logbook，harness 只记录执行地图和证据引用。

## 旧服务器目标锁定（0.8.3-r1）

Gray 与 Production 发布和运行时验证必须显式传入 `--target-profile=old-server`。该配置唯一允许 `101.33.75.38:728` 上的两套既定根目录、服务、状态地址和数据库名；任何目标覆盖值不一致时必须以 `OLD_SERVER_TARGET_MISMATCH` 失败。`config/environments.json` 中的其他服务器仅供其原有流程使用，不能作为本次 0.8.3 发布默认值。

Agent 发布前必须先运行 `verify:agent-environment-readiness-contract`。实时 Agent readiness 默认使用 `--readiness=check` 并只读取管理员治理端点；若发布负责人明确选择 `--readiness=skip`，结果必须记录 `liveReadiness=skipped`，不能作为 Agent 已验证的证据。仅 `check` 需要 `--admin-cookie-env`。可能计费的前台和后台探针仍只有显式传入 `--allow-billed-canaries=true` 才执行，且必须返回 `mode=agent`，不能接受 fallback。
