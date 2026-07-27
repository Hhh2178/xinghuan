# Image Result Aggregation Seam 验证（0.8.3-r13）

## 稳定性行为

- ImageNode 并发生成回传统一经过 `image-node-runtime.ts` 聚合：可读图片 URL、远端 URL 和 task ID 去重，保持 Provider 回传顺序并保留最新 task ID。
- 同一任务重复回传不会重复产物或 task ID，仍可用于恢复与取消；既有“至少一个可读产物才成功”的终态规则不变。

## 证据

- `image-node-runtime.test.ts` focused tests 通过；远端 CI 全部通过：203 test files，812 passed，4 skipped。
- r13 release prepare、构建、归档、热点、工程治理、版本和包契约门禁通过。
- 旧服务器 Gray 严格验证通过：r13、API/Worker active、内部/公网状态均为 0.8.3/gray、permission readiness ready。
- 旧服务器 Production 严格验证通过：r13、API/Worker active、内部/公网状态均为 0.8.3/production、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `9bcb4fa42a5aa782a8684bb8be0b4b8cb43fd1bd` 和同一归档 SHA-256 `E1C806BD0D611C8B84F3E6F78C1CDA0D62C9F3AB2E8ACECBA24438C1355D619E`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
