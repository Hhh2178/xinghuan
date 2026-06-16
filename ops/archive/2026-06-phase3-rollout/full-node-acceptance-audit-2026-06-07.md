# 完整测试链路与全节点验收审计 - 2026-06-07

## 目标来源

用户目标：完成完整测试链路，自行测试并验收通过，完成所有节点的验收验证。

## 验收范围

- 46 个注册节点的组件映射、端口声明、默认数据和可执行节点合同。
- 真实浏览器画布中 46 个注册节点全部渲染。
- 单端口 Web/Admin/API 认证链路。
- 后台模型目录和通用图像/视频/LLM 节点消费链路。
- 图像/视频/LLM 外部代理和供应商短链。
- 任务 payload/result、取消/重试生命周期。
- 画布/素材 API。
- 输出节点预览自适应布局。
- Worker 合同、GRSAI 合同、输出素材落库。
- 14 天保守输出素材清理规则。
- RunningHub 目录/字段映射合同和 API 空目录链路。

## 本机证据

- `npm run verify:local-acceptance-chain` 通过，临时服务 `http://127.0.0.1:18333` 输出 `ok=true`。
- 本机完整链路包含：
  - `build:single-port`
  - `verify:single-port`
  - `verify:node-acceptance-matrix`
  - `verify:canvas-node-render-smoke`
  - `verify:generic-node-catalog`
  - `verify:model-catalog`
  - `verify:ai-watermark-api`
  - `verify:external-image-proxy`
  - `verify:external-video-proxy`
  - `verify:external-chat-proxy`
  - `verify:task-payload-api`
  - `verify:task-lifecycle`
  - `verify:canvas-resource-api`
  - `verify:output-node-preview-layout`
  - `verify:runninghub-workflow-contract`
  - `verify:runninghub-workflow-api`
  - `verify:worker-adapter-contract`
  - `verify:worker-grsai-contract`
  - `verify:worker-output-materializer`
  - `verify:output-material-prune`

## 灰度证据

- 灰度 release：`20260607-1545-node-acceptance-gray`
- 灰度入口：`https://canvas-next.hhh2121.xyz`
- API/Worker 状态：`active`
- `/api/status`：`environment=gray`
- 服务器灰度已通过：
  - `verify:single-port`
  - `verify:node-acceptance-matrix`
  - `verify:ai-watermark-api`
  - `verify:generic-node-catalog`
  - `verify:model-catalog`
  - `verify:external-image-proxy`
  - `verify:external-video-proxy`
  - `verify:external-chat-proxy`
  - `verify:task-payload-api`
  - `verify:task-lifecycle`
  - `verify:canvas-resource-api`
  - `verify:output-node-preview-layout`
  - `verify:runninghub-workflow-contract`
  - `verify:runninghub-workflow-api`
  - `verify:worker-adapter-contract`
  - `verify:worker-grsai-contract`
  - `verify:worker-output-materializer`
  - `verify:output-material-prune`
- 公网灰度浏览器烟测通过：
  - `expectedNodeCount=46`
  - `renderedNodeCount=46`
  - `missingIds=[]`
  - `classMismatches=[]`
  - `legacyFound=[]`
  - `runtimeErrors=[]`

## 生产证据

- 生产 release：`20260607-1610-node-acceptance-prod`
- 生产入口：`https://canvas.hhh2121.xyz`
- API/Worker 状态：`active`
- `/api/status`：`environment=production`
- 服务器生产已通过：
  - `verify:single-port`
  - `verify:node-acceptance-matrix`
  - `verify:ai-watermark-api`
  - `verify:generic-node-catalog`
  - `verify:model-catalog`
  - `verify:external-image-proxy`
  - `verify:external-video-proxy`
  - `verify:external-chat-proxy`
  - `verify:task-payload-api`
  - `verify:task-lifecycle`
  - `verify:canvas-resource-api`
  - `verify:output-node-preview-layout`
  - `verify:runninghub-workflow-contract`
  - `verify:runninghub-workflow-api`
  - `verify:worker-adapter-contract`
  - `verify:worker-grsai-contract`
  - `verify:worker-output-materializer`
  - `verify:worker-output-materials`
  - `verify:output-material-prune`
- 公网生产浏览器烟测通过：
  - `expectedNodeCount=46`
  - `renderedNodeCount=46`
  - `missingIds=[]`
  - `classMismatches=[]`
  - `legacyFound=[]`
  - `runtimeErrors=[]`

## 暂缓项

- RunningHub 真实工作流卡片录入、字段展开和预览运行测试已按用户明确要求暂缓。
- 当前已验收的是 RunningHub 合同、目录接口和空目录链路。

## 已知后续优化

- Web 构建仍有大 chunk 和空 `vendor-react` chunk 警告，属于性能优化项。
- 生产级密钥轮换、长期审计和独立数据库隔离仍是运维治理项。
- 去 AI 水印当前只提供结构化未配置兜底，真实 Adapter 尚未接入。

## 结论

在用户明确暂缓 RunningHub 真实工作流测试的前提下，完整测试链路和 46 个注册节点验收已在本机、灰度和生产通过。当前目标可视为完成。
