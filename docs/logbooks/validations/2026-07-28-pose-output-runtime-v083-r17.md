# PoseMaster Output Runtime Seam 验证（0.8.3-r17）

## 稳定性行为

- PoseMaster single/collection 输出字段由 `pose-output-runtime.ts` 统一生成，保持 image URL、prompt、metadata、source ID 和 output mode 一致。
- managed output 优先复用；重复的 legacy 自动 output 节点被确定性识别并清理，避免重复产物和下游分叉。

## 证据

- 全量 CI：207 test files，817 passed，4 skipped；Web/Admin 构建和 type-check 通过。
- r17 release prepare、构建、归档、热点、工程治理、版本和包契约门禁通过。
- 旧服务器 Gray 严格验证通过：r17、API/Worker active、内部/公网状态均为 0.8.3/gray、permission readiness ready。
- 旧服务器 Production 严格验证通过：r17、API/Worker active、内部/公网状态均为 0.8.3/production、permission readiness ready。
- Gray 与 Production 使用同一源码提交 `6793f08b0bc5203d0a5cb1b8d72fb32e3a63387b` 和同一归档 SHA-256 `8C4B3266D065543A91BB4D3BD0A81CCF34DC4393D5407AA2F5899C5CB0E0181F`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
