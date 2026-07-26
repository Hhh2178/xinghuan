# Video Prompt Provider Limit v0.8.1 Validation

- release: `20260726-video-prompt-provider-limit-v081-r1`
- version: `0.8.1`
- source commit: `04a9e87`
- archive SHA-256: `9AA0205D3F38BE4C452CC27247ABEBF3B9E8331C3436D4122057B29FC6AD3709`

## Local

- Focused video validation: `21 passed`。
- Full test suite: `179 passed, 1 skipped`; `738 passed, 4 skipped`。
- API type-check、single-port build、release package contract 和提交治理门禁通过。

## Runtime

| 主机 | 环境 | 公网状态 | API/Worker | 权限 readiness |
|---|---|---|---|---|
| 旧服务器 | Gray | `canvas-next.hhh2121.xyz` 200，`0.8.1 / gray / enforced` | active / active | ready |
| 旧服务器 | Production | `canvas.hhh2121.xyz` 200，`0.8.1 / production / enforced` | active / active | ready |
| 新服务器 | Gray | `canvas-next.zezhen.online` 200，`0.8.1 / gray / enforced` | active / active | ready |
| 新服务器 | Production | `canvas.zezhen.online` 200，`0.8.1 / production / enforced` | active / active | ready |

## Boundary

- GitHub 未在本批次推送。
- 旧服务器未下线。
- 未执行 release retention prune；生产构建包和用户媒体未删除或迁移。
