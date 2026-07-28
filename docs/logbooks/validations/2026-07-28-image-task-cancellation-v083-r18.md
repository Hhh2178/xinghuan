# Image Task Cancellation Compatibility 验证（0.8.3-r18）

## 稳定性行为

- ImageNode 取消动作统一合并当前任务、节点已知任务、持久化 taskRun 和可恢复 taskRun ID，并去重后逐一取消。
- 该边界覆盖 Provider 并发回传期间的重试/恢复任务，避免带宽受限或页面重载时因遗漏 task ID 造成错误终止或残留运行。

## 证据

- 全量 CI：208 test files，818 passed，4 skipped；Web/Admin 构建和 type-check 通过。
- r18 release prepare、构建、归档、热点、工程治理、版本和包契约门禁通过。
- 旧服务器 Gray 与 Production 严格运行态验证均通过：API/Worker active、内部/公网状态匹配 0.8.3 与环境、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `565c1f20bb75be00a89b518cfa8ec4611d8bbf49` 和归档 SHA-256 `3153FB017AB3E9BC1344CE8741F13A666D15C0F0AA1FDFB498D24F3A52817DA2`。
- 后续需在旧服务器 Gray 以临时 member 账号执行画布视觉回归、图片/视频 Provider 真实链路和带宽受限并发回传测试；本记录不把未执行的付费请求标记为通过。
