# Canvas Shell CSS Boundary 验证（0.8.3-r14）

## 稳定性行为

- Canvas shell 的背景层、ReactFlow 层级和视觉主题变量进入显式 CSS seam，保留 pointer-events、isolation、edge/node stacking 与 cascade 顺序。
- CSS contract test 拒绝新的 broad `html/body/*` 选择器，并锁定入口 import、shell/background/edge 选择器；r13 的 Provider 回传聚合与恢复 task 去重继续生效。

## 证据

- 全量 CI：204 test files，813 passed，4 skipped；Web/Admin 构建、type-check、Canvas assistant UI contract 通过。
- r14 release prepare、构建、归档、热点、工程治理、版本和包契约门禁通过。
- 旧服务器 Gray 严格验证通过：r14、API/Worker active、内部/公网状态均为 0.8.3/gray、permission readiness ready。
- 旧服务器 Production 严格验证通过：r14、API/Worker active、内部/公网状态均为 0.8.3/production、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `5c56dc01fb84310cd280fd0043806c80df6e395b` 和同一归档 SHA-256 `B2A02DAB368FD013046BB749AA13880B9FB7113E66A100317BD7FED1A1865733`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
