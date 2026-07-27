# Node Chrome CSS Boundary 验证（0.8.3-r15）

## 稳定性行为

- ReactFlow 节点滚动条和 NodeActionBar token 通过 `node-chrome.css` 显式导入，保持 node-scoped 选择器，避免节点 chrome 规则污染全局入口。
- r14 Canvas shell 层级、r13 Provider 回传聚合与恢复 task 去重继续生效。

## 证据

- 全量 CI：205 test files，814 passed，4 skipped；Web/Admin 构建、type-check、Canvas assistant UI contract 通过。
- r15 release prepare、构建、归档、热点、工程治理、版本和包契约门禁通过。
- 旧服务器 Gray 严格验证通过：r15、API/Worker active、内部/公网状态均为 0.8.3/gray、permission readiness ready。
- 旧服务器 Production 严格验证通过：r15、API/Worker active、内部/公网状态均为 0.8.3/production、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `5cf6b1f3808f7fc0f30866c647b91cbbb2269b77` 和同一归档 SHA-256 `0AC0F40DA118B79FD93FAD1BCDB81C6E7B62913943CF9C3218AEB263C97F1427`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
