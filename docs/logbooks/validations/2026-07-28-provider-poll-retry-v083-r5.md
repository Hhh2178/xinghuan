# Provider Poll Retry 验证（0.8.3-r5）

## 稳定性行为

- RunningHub 标准模型提交请求保持单次调用，不对提交端 5xx/网络错误自动重试，避免不确定的重复计费。
- 查询请求复用 `fetchPollResponseWithRetry`，在截止时间内覆盖 408/425/429/5xx/网络错误瞬态故障。
- 每次重试和恢复只写入 sanitized `pollRetryCount`、`pollRetryLimit`、`lastPollHttpStatus`、`nextPollRetryDelayMs` 等运行字段，不写入 API Key、签名 URL 或响应密文。

## 证据

- `worker-runninghub-standard-adapter.test.ts`：5 passed，证明 503 查询恢复后仍是 1 次提交、2 次查询并成功返回；心跳包含重试与恢复字段。
- 全量 Vitest：191 files passed、792 tests passed、1 skipped file、4 skipped tests。
- 全 workspace type-check 通过。
- Gray/Production 同 SHA 发布包：`0D66745F2BE91A019928C5F7579EA2BA394C29F1854F7511D602CE076ED81C28`。
- Gray 与 Production 严格运行态验证均通过；未执行 retention apply、历史发布删除或付费 Provider canary。
