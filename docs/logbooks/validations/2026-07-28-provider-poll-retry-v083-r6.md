# Provider Catalog Poll Retry 验证（0.8.3-r6）

## 稳定性行为

- RunningHub App/Workflow 与标准模型提交请求均保持单次调用，不对可计费提交端自动重试。
- 查询请求复用 `fetchPollResponseWithRetry`，在任务截止时间内覆盖 408/425/429/5xx/网络瞬态故障。
- 每次重试和恢复只写入 sanitized `pollRetryCount`、`pollRetryLimit`、`lastPollHttpStatus`、`nextPollRetryDelayMs` 等运行字段，不写入 API Key、签名 URL 或响应密文。

## 证据

- `worker-runninghub-client.test.ts`：证明 503 查询恢复后仍是 1 次提交、2 次查询并成功返回图片；心跳包含重试与恢复字段。
- 全量 Vitest：192 files passed、793 tests passed、1 skipped file、4 skipped tests。
- 全 workspace type-check 通过；r6 release prepare 的构建、版本、治理和归档门禁通过。
- Gray 严格运行态通过：旧服务器 Gray 当前 r6，API/Worker active，内部/公网状态均为 0.8.3/gray。
- Production 严格运行态通过：旧服务器 Production 当前 r6，API/Worker active，内部/公网状态均为 0.8.3/production；首次公网连接超时后复核成功。
- Gray 与 Production 使用同一源码提交 `d067e468758c3d46e907170aef03cae2fbf2660d` 和同一归档 SHA-256 `FD81820DB7340376599738CB1FBF276F4CDFA5CBACBBA51B3A46899C8809CCC1`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
