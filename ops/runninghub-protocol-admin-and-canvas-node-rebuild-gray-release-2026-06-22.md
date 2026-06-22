# RunningHub Protocol Admin And Canvas Node Rebuild Gray Release - 2026-06-22

## Release

- environment: `gray`
- version: `v0.4.1`
- gray release:
  - `20260622-runninghub-rebuild-gray-r2-v041-8faaadf`
- previous gray attempt:
  - `20260622-runninghub-rebuild-gray-r1-v041-9e1f2fe`
- current symlink:
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260622-runninghub-rebuild-gray-r2-v041-8faaadf`

## Scope

- RunningHub 后台工作台补齐 `requestExample / responseExample` 输入面板。
- `/api/admin/runninghub/analyze` 从 `requestExample.nodeInfoList` 解析字段草案并生成 `fields`。
- 修复 `runTargetId` 校验，避免错误条目继续伪装成可执行配置。
- 去掉 `instanceType = plus` 默认兜底，避免协议被静默污染。
- 画布 RH 节点继续按后台 catalog 与真实字段定义消费，不再依赖旧兜底实例类型。

## Hotfix

- `r1` 灰度实查时发现分析接口把长 `requestExample` 截断成短文本，导致服务端误报“不是合法 JSON 对象”。
- 热修提交：
  - `8faaadf fix: preserve long runninghub analyze examples`
- 修复点：
  - `apps/api/src/server.ts`
  - `parseRunningHubExampleObject` 改为 `safeLongText(value, "", 16000)`
- 契约补强：
  - `scripts/verify-runninghub-analyze-contract.mjs` 增加对长样例保留能力的回归校验。

## Verification

- local:
  - `npm run type-check`
  - `npm run verify:runninghub-analyze-contract`
  - `npm run verify:runninghub-workflow-contract`
  - `npm run verify:runninghub-queue-governance-contract`
  - `npm run verify:runninghub-workflow-api`
  - `npm run build:single-port`
  - `npm run verify:single-port`
  - `npm run verify:local-acceptance-chain`
- gray gate:
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
- gray runtime:
  - `/api/status => version = 0.4.1, environment = gray`
  - database target:
    - `current = xinghuan_canvas_gray`
    - `expected = xinghuan_canvas_gray`
    - `targetMatched = true`

## Functional Acceptance

- 直接调用灰度 `POST /api/admin/runninghub/analyze` 已返回结构化草案：
  - `inputs.payload.fields` 包含：
    - `12.prompt`
    - `15.negative_prompt`
    - `18.seed`
- 灰度后台页面实测：
  - 分析面板已显示 `请求示例 / 响应示例`
  - 点击“AI 分析并填写”后会渲染：
    - `基础信息草案`
    - `输入槽草案`
    - `参数 Schema 草案`
    - `输出定义草案`
    - `执行规则草案`
  - 输入槽卡片与 Schema 草案已包含：
    - `prompt`
    - `negative prompt`
    - `seed`
- 本轮 UI 验证使用 Playwright + Edge 对 gray 页面做了真实登录、点击、截图前后对比，不再只依赖接口返回。

## Operational Notes

- `scripts/package-release.mjs` 当前产出的仍是 runtime-only 包。
- 该包不足以在服务器 release 目录重新执行 `npm run build:single-port`，因为缺少完整构建依赖链。
- 当前可用流程仍是：
  - 本机构建通过
  - 服务器 `npm ci`
  - 服务器 `db:migrate`
  - 切换 symlink
  - 重启服务
  - 跑 gray gate
- 后续如果发布包含 migration 或要求服务器重建，必须先补 release 打包/运行手册缺口。
