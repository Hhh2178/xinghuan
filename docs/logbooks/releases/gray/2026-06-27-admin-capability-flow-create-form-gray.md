# Admin Capability Flow And Create Form Gray Release - 2026-06-27

## 状态

- 环境：`gray`
- 版本：`v0.5.12`
- release：`20260627-admin-capability-flow-create-form-gray-r1-v0512`
- 当前状态：`2026-06-27 已完成 deploy + runtime verify`
- 上一灰度 release：`20260627-admin-structural-layout-fixes-gray-r1-v0511`

## 发布目标

- 修复 `能力配置 / API 设置` 页面仍出现平台列表覆盖下层能力配置结构的问题。
- 去除 `组织与治理 / 账号 / 新增成员` 中 `账号备注` 和 `初始密码` 被浏览器自动填充的默认内容。

## 根因

- `providers` 页仍被外层 `admin-main--fixed-panel` 包裹。该 fixed panel 只适合两段式页面，但当前后台主区域有顶栏、错误条、工作区 band、页面内容等多个直接子节点，导致能力配置内容被固定 grid 和隐藏溢出压入异常层叠关系。
- 新增成员表单虽然 React 状态为空，但普通输入框缺少明确 `name` 与 `autoComplete` 约束，浏览器或密码管理器会把当前登录邮箱、保存密码自动填入备注和初始密码区域。

## 变更范围

- `apps/admin/src/main.tsx`
  - `providers` 不再套用 `admin-main--fixed-panel`，改回正常文档流；`assistant` 与 `environment-sync` 保留固定面板行为。
- `apps/admin/src/admin-user-accounts-section.tsx`
  - 新增成员容器改为真实 `form autoComplete="off"`。
  - 邮箱、名称、账号备注、初始密码字段增加唯一 `name`、`autoComplete` 和 `data-lpignore`，初始密码字段使用 `autoComplete="new-password"`。
  - 创建按钮改为 submit，由表单统一提交，避免额外改变现有视觉结构。
- `scripts/verify-admin-layout-overlap-fixes-contract.mjs`
  - 增加能力配置页不能套 fixed panel 的契约。
  - 增加新增成员备注和初始密码防自动填充契约。
- 版本推进：
  - monorepo 工作区版本从 `v0.5.11` 推进到 `v0.5.12`。

## Agent 已验证

### 本地代码与产物

- `npm run verify:admin-layout-overlap-fixes`
- `npm run verify:admin-api-layout-contract`
- `npm run build -w @xinghuan/admin`

### Gray 发布与运行态

- `npm run release:gray:prepare -- --release=20260627-admin-capability-flow-create-form-gray-r1-v0512 --verify="npm run verify:admin-layout-overlap-fixes" --verify="npm run verify:admin-api-layout-contract" --verify="npm run build -w @xinghuan/admin"`
- `npm run release:gray:deploy -- --release=20260627-admin-capability-flow-create-form-gray-r1-v0512 --archive=dist-release/20260627-admin-capability-flow-create-form-gray-r1-v0512.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.12 --expected-environment=gray`

### 部署结果

- 当前 release 指针：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-capability-flow-create-form-gray-r1-v0512`
- systemd 状态：
  - `xinghuan-canvas-next.service`: `active`
  - `xinghuan-canvas-next-worker.service`: `active`
- 内网状态：
  - `http://127.0.0.1:18200/api/status`
  - `status=ok`
  - `version=0.5.12`
  - `environment=gray`
- 公网状态：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `status=ok`
  - `version=0.5.12`
  - `environment=gray`

## 待用户验收

- `能力配置 / API 设置`：平台列表是否只作为左侧列存在，不再盖住能力配置说明、API/RH 切换或右侧表单。
- `组织与治理 / 账号 / 新增成员`：`账号备注` 与 `初始密码` 初始状态是否保持为空；只有点击 `生成强密码` 后才填入密码。

## 回滚信息

- deploy 前回滚锚点：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-structural-layout-fixes-gray-r1-v0511`
- 当前目标 release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260627-admin-capability-flow-create-form-gray-r1-v0512`
- 回滚后需重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
