# Admin Capability Flow And Create Form Production Release - 2026-06-27

## 状态

- 环境：`production`
- 版本：`v0.5.12`
- release：`20260627-admin-capability-flow-create-form-prod-r1-v0512`
- 当前状态：`2026-06-27 已完成 production deploy + runtime verify`
- 晋级来源 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-capability-flow-create-form-gray-r1-v0512`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260624-timeout-zero-and-app-shell-loading-prod-r2-v051`

## 发布目标

- 将灰度已验证的后台能力配置页面文档流修复晋级到正式环境。
- 将新增成员表单防浏览器自动填充修复晋级到正式环境。
- 按用户要求让 gray 与 production 对外版本号同步为 `v0.5.12`。

## 变更范围

- `能力配置 / API 设置`
  - `providers` 页不再套用 fixed panel 外层布局，避免平台列表覆盖下层能力配置结构。
- `组织与治理 / 账号 / 新增成员`
  - 账号备注和初始密码字段增加防自动填充约束，初始状态保持为空。
- `scripts/release/deploy-gray-release.mjs`
  - 部署脚本补充 `--shared-env-file` 参数，默认保持灰度 `canvas-next.env`，正式发布可显式使用 production `canvas.env`。

## Agent 已验证

### 本地验证

- `npm run verify:release-worktree-clean`
- `npm run verify:admin-layout-overlap-fixes`
- `npm run verify:admin-api-layout-contract`
- `npm run release:gray:prepare -- --release=20260627-admin-capability-flow-create-form-prod-r1-v0512 --verify="npm run verify:admin-layout-overlap-fixes" --verify="npm run verify:admin-api-layout-contract" --verify="npm run build -w @xinghuan/admin"`

### Production 部署与运行态

- 发布包：
  - `dist-release/20260627-admin-capability-flow-create-form-prod-r1-v0512.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas/releases/20260627-admin-capability-flow-create-form-prod-r1-v0512`
- current 指针：
  - `/opt/apps/xinghuan-canvas/releases/20260627-admin-capability-flow-create-form-prod-r1-v0512`
- systemd 状态：
  - `xinghuan-canvas.service`: `active`
  - `xinghuan-canvas-worker.service`: `active`
- 内网状态：
  - `http://127.0.0.1:18100/api/status`
  - `version = 0.5.12`
  - `environment = production`
- 公网状态：
  - `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.5.12`
  - `environment = production`
- 生产 env 下迁移：
  - `npm run db:migrate`
  - `applied = ["019_group_permission_policies.sql"]`
  - `skipped = 18`

## 部署备注

- 首次复用 gray deploy 脚本指定 production 目录时，脚本仍默认寻找 `shared/canvas-next.env`，正式目录实际为 `shared/canvas.env`。
- 该脚本报错发生在迁移 env source 阶段；随后确认 current 已指向新 release，服务已为 `active`，并补跑了正确 production env 下的 `db:migrate`。
- 本轮同步修复部署脚本，后续 production 可显式传入：
  - `--shared-env-file=/opt/apps/xinghuan-canvas/shared/canvas.env`

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260624-timeout-zero-and-app-shell-loading-prod-r2-v051`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 待用户验收

- 正式环境 `能力配置 / API 设置`：平台列表是否不再覆盖下层能力配置内容。
- 正式环境 `新增成员`：账号备注和初始密码是否保持空白，点击生成强密码后再填入。
