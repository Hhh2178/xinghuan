# RunningHub Tolerant Analyze And Node Adaptation Gray Release - 2026-06-22

## Release

- environment: `gray`
- version: `v0.4.2`
- release id:
  - `待发布`
- based on:
  - `v0.4.1 gray`
  - `20260622-runninghub-rebuild-gray-r2-v041-8faaadf`

## Scope

- RH analyze 继续升级为容错解析：
  - 支持混合文本中的 JSON 对象抽取
  - 支持 fenced JSON 与嵌套对象片段
- `/api/admin/runninghub/analyze` 继续增强：
  - `docUrl` 参与能力判断与目标推断
  - `requestExample` 自动生成 `fields`
  - `responseExample` 自动推断 `outputSchema` 与执行规则草案
- public RH catalog 透传 `outputSchema`
- 画布 RH 节点优先消费后台 `outputSchema`
- RH 节点补充输出映射摘要与 `audio` 输出端口

## Expected Verification

- local:
  - `npm run type-check`
  - `npm run verify:runninghub-analyze-contract`
  - `npm run verify:runninghub-workflow-contract`
  - `npm run verify:runninghub-queue-governance-contract`
  - `npm run verify:runninghub-workflow-api`
  - `npm run build:single-port`
  - `npm run verify:single-port`
- gray:
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`

## Acceptance Targets

- gray RH 工作台分析面板继续只有：
  - `请求示例`
  - `响应示例`
- 但点击 `AI 分析并填写` 后应真实生成：
  - `基础信息草案`
  - `输入槽草案`
  - `参数 Schema 草案`
  - `输出定义草案`
  - `执行规则草案`
- 使用混合文本样例时，应可提取：
  - `12.prompt`
  - `13.image`
- 使用响应样例时，应可推断：
  - `输出视频`
  - `path = data.outputs`
- 画布 RH 节点应显示：
  - 输出映射摘要
  - `audio` 输出类型支持

## Notes

- 本轮发布是对 `v0.4.1` RH 工作台能力的继续收口，不是 Hermes 接入。
- RH analyze 仍是本地规则引擎，不依赖外部 Hermes 分析服务。
- `scripts/package-release.mjs` 仍是 runtime-only 包；若后续需要服务器端重建或带 migration 发布，仍需补打包依赖链。
