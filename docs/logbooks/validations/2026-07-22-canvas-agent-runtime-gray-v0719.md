# Canvas Agent Runtime Gray v0.7.19 验证

## 发布与运行态

- Gray runtime verifier 通过：`v0.7.19 / gray`，API 与 Worker 均处于 active。
- 发布包包含新增 `@xinghuan/agent-core` 运行时产物及当前画布上下文实现；首次遗漏包内容的问题已按复盘修复后重新部署。
- `npm run harness:verify:project`、定向 Agent/API/Worker 测试、API/Web/Worker type-check 与 Web production build 均在发布前通过。

## 真实压力任务

- 3 个并发分组 `text -> Grok 4.5 LLM` Canvas Run 成功。
- 2 个并发 `text -> nano-banana-fast` 生图 Canvas Run 成功。
- 每个 Run 的追加式事件账本均包含 created、start、确定性文本步骤、任务派发与 succeeded 终态。
- 悬浮助手真实请求返回 `agent` 模式，不是未配置时的 fallback。

## 交互与安全回归

- 当前画布附件使用有界投影，Web 与 API 均过滤 token、password、secret、cookie、authorization 等敏感字段。
- 工作台以 header、tabs、context、conversation、composer 独立网格行组织，协作内容不覆盖托管 Tab；完整问题复盘见 `../retrospectives/2026-07-22-assistant-workbench-tab-layering.md`。
- 本轮浏览器自动化连接不可用，最终运行态以 Gray verifier、已部署构建产物和前序受认证 UI 验收为准；后续继续以真实登录态做持续视觉回归。

## 留存与边界

- `release:retention:prune` dry-run/apply 均通过，确认值为 5。Gray 当前只有 4 个 release，未删除任何目录。
- Production、生产数据、服务商配置、既有任务参数和 GitHub 均未修改。
