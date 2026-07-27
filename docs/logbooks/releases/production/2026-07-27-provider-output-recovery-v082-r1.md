# Provider Output Recovery v0.8.2 Production

- release: `20260727-provider-output-recovery-v082-r1`
- version: `0.8.2`
- source commit: `55aa3d9`
- archive SHA-256: `F1607BADC97988CD79E3C9FBA344F67839257BFB3C466AAF5409E3418BF8B6A1`
- rollback: `20260726-video-prompt-provider-limit-v081-r1`

## Scope

- 将已在 Gray 部署和验证的 Provider 输出恢复链路晋级 Production。
- 内容下载支持瞬时 HTTP 错误重试、响应流中断分类和 Range 续传。
- Provider 已成功但物料化失败时保留远端产物，并提供 `recover-output` 恢复入口；发布后审计发现恢复模式字段的 API/Worker 契约不一致，该入口尚不能证明不重复调用 Provider。
- Redis 入队增加连接和命令超时。

## Deployment

- 旧服务器 Production：`canvas.hhh2121.xyz`，current 切换至本 release。
- 新服务器 Production 本轮不操作；`zezhen.online` 注册商暂停解析期间不作为正式入口。
- 数据库迁移按 release 脚本执行；不修改用户媒体、Provider Key 或运行时 secrets。

## Result

- Production 内部/公网状态、API/Worker、权限 readiness 和入口页面全部通过，对应证据由 validation 台账记录。
- Production Agent bootstrap、三组 Agent/route publication 和 `observe` 运行控制已补齐；前后台助手真实请求均返回 `mode=agent`。
- `recover-output` 契约缺陷列为后续 Gray-first P0；修复前 Production 不使用恢复按钮。
- Retention 仅完成 dry-run，current 与 rollback 均受保护，未执行历史 release 清理。
