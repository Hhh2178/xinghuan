# Canvas Visibility Evaluation and Pose Schema 验证（0.8.3-r7）

## 稳定性行为

- 大画布可见性评估记录了分组离屏 DOM、selection、跨视口边、fit-view 与 runtime projection 的风险，暂不启用 ReactFlow `onlyRenderVisibleElements`，避免在缺少真实 renderer 证据时改变行为。
- PoseMaster 字段 schema 与选项目录抽离为独立模块，保持已持久化 ID、顺序和运行时行为不变。
- r6 的 Provider 查询瞬态重试与恢复心跳继续随 r7 发布。

## 证据

- 全量 Vitest：194 files passed、797 tests passed、1 skipped file、4 skipped tests。
- 全 workspace type-check 通过；r7 release prepare 的构建、版本、治理和归档门禁通过。
- 旧服务器 Gray 严格验证通过：r7、API/Worker active、内部/公网状态均为 0.8.3/gray。
- 旧服务器 Production 严格验证通过：r7、API/Worker active、内部/公网状态均为 0.8.3/production。
- Gray 与 Production 使用同一源码提交 `602288e00b85b5f5ed85e5ad25ae9dc2461f78d5` 和同一归档 SHA-256 `DDC4BC055CE1E9092E394785D1338F7442B5AEF315109B901835F6AA1EBF55B7`。
- 独立本地单端口 Chrome/CDP Canvas smoke 通过：56 个注册节点全部渲染，0 missing、0 class mismatch、0 runtime error、0 network failure，无登录残留和错误边界。
- `verify:local-acceptance-chain` 在浏览器 smoke 前于本地视频样例种子项失败（`Local sample video seeded` / generation-library video）；该环境型样例失败未被计入 Canvas 或 Provider 成功结论。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
