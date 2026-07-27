# Error Recovery CSS Boundary 验证（0.8.3-r12）

## 稳定性行为

- Workspace/node error boundary 的回退面板样式从主入口 CSS 独立，仍由 `index.css` 显式导入，避免崩溃样式被页面通用规则污染。
- 契约拒绝 `html/body/*` 宽 selector，保留工作区与节点两级窄命名空间及可键盘聚焦的恢复按钮。

## 证据

- `error-recovery.test.ts` focused contract 通过；远端 CI 全部通过：202 test files，810 passed，4 skipped。
- Web type-check/build、视觉文档契约、热点与 release prepare/package 门禁通过。
- 旧服务器 Gray 严格验证通过：r12、API/Worker active、内部/公网状态均为 0.8.3/gray、permission readiness ready。
- 旧服务器 Production 严格验证通过：r12、API/Worker active、内部/公网状态均为 0.8.3/production、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `e15678e48b1ac9716af09d92b06c1f1b4489889e` 和同一归档 SHA-256 `6CB3C2A940EFF173BE517124D7381B5A6A47F1EAA883900B037D36CA8CC2C264`。
- `verify:xinghuan-entry-ui` 的 6 项登录/星图/启动文案检查仍为既有失败；本轮 focused CSS、构建和 CI 未引入新的失败。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
