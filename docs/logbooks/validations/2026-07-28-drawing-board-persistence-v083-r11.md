# DrawingBoard Persistence Seam 验证（0.8.3-r11）

## 稳定性行为

- DrawingBoard 持久化统一从 layer snapshot 生成 `boardLayers` 与 legacy `boardElements`，避免两份节点数据漂移。
- 恢复到仅含 group 的旧数据时自动提供可编辑 layer，避免画板打开后无法继续编辑或保存。

## 证据

- `drawing-board-persistence.test.ts` focused tests 通过；远端 CI 全部通过：201 test files，809 passed，4 skipped。
- r11 release prepare、构建、归档、热点、工程治理、版本和包契约门禁通过。
- 旧服务器 Gray 严格验证通过：r11、API/Worker active、内部/公网状态均为 0.8.3/gray、permission readiness ready。
- 旧服务器 Production 严格验证通过：r11、API/Worker active、内部/公网状态均为 0.8.3/production、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `36d9205b15485658392d52d3da7f8d6f20b65494` 和同一归档 SHA-256 `25DB58B9797D6466BF5EF1228359E8E8FE95CFF52C3A46FD6F5A8CFB94FAC808`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
