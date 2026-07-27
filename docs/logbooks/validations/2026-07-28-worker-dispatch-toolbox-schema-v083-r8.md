# Worker Dispatch and Toolbox Schema 验证（0.8.3-r8）

## 稳定性行为

- `worker-operation-dispatch.ts` 统一区分 Provider execution、output-only recovery 与 deterministic Canvas operation；恢复任务不会重新调用 Provider，确定性节点不会创建 Provider task。
- ToolboxParam schema 与多角度归一化抽离保持既有持久化 ID、排序和自定义角度去重行为。
- r7 的大画布可见性评估、PoseMaster schema、Provider 查询重试和物料化原子边界继续有效。

## 证据

- 全量 Vitest：196 files passed、801 tests passed、1 skipped file、4 skipped tests。
- 全 workspace type-check 通过；r8 release prepare 的构建、版本、治理和归档门禁通过。
- 旧服务器 Gray 严格验证通过：r8、API/Worker active、内部/公网状态均为 0.8.3/gray。
- 旧服务器 Production 严格验证通过：r8、API/Worker active、内部/公网状态均为 0.8.3/production。
- Gray 与 Production 使用同一源码提交 `33550541d50b524ded943cade3d82e05fb9f5b5b` 和同一归档 SHA-256 `E844E0FF55403F72DCC7A98A09A66EC5938787965E0A71C84D4C872A7541D612`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
