# API Model Import Seam 验证（0.8.3-r10）

## 稳定性行为

- Provider model import 的 capability/tag/protocol normalization、stable-field 保留和新模型默认输入能力由纯模块负责，避免主 API 入口重复维护 merge 细节。
- 更新已有模型时保持 id、inputProfile、parameterSchema、advancedConfig、testState 与 createdAt；新增模型按 capability 提供安全默认值。

## 证据

- `provider-model-import.test.ts` focused tests 通过；远端 CI 全部通过：200 test files，807 passed，4 skipped。
- r10 release prepare、构建、归档、热点、工程治理、版本和包契约门禁通过。
- 旧服务器 Gray 严格验证通过：r10、API/Worker active、内部/公网状态均为 0.8.3/gray、permission readiness ready。
- 旧服务器 Production 严格验证通过：r10、API/Worker active、内部/公网状态均为 0.8.3/production、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `693baac4b8234da82fdc4fa73e5e5d4bc57ee9c0` 和同一归档 SHA-256 `E810006EA1129B4C81CF3E249B83919292B1F5108936ACE2348E374190A66079`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
