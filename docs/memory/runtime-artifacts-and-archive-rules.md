# 运行产物与归档规则历史

> 从 MEMORY.md 拆出的历史主题正文，保留原始长期记忆内容，后续相关更新优先写入更细的主题文件或对应系统目录。

## 运行产物与归档规则记忆

- `output/`、`releases/`、`dist-release/`、`logs/`、`.tmp/`、`.codex-temp/`、`.codegraph/`、`.playwright-cli/` 都属于运行产物或本机辅助目录，不是正式源码结构。
- 运行产物目录的正式边界说明已经沉淀到：
  - `docs/runtime-artifacts.md`
- 当前整理策略不是直接清空运行产物，而是：
  - 先把长期有效结论收口到 `docs/`、`ops/`、`DEVLOG.md`、`MEMORY.md`
  - 再按单个明确路径清理无用文件
  - 禁止批量删除
- `ops/` 中第一批明显历史化的灰度初期材料已移动到：
  - `ops/archive/2026-06-initial-rollout/`
- `2026-06-16` `ops/` 主入口已继续收束，新增归档批次：
  - `ops/archive/2026-06-assistant-and-ui-rollout/`
  - `ops/archive/2026-06-provider-and-infra-rollout/`
  - 当前要求是：`ops/README.md` 的“当前运行态 / 当前放行入口”只保留当前 active release 仍直接依赖的材料，早期 UI、助手、Provider 和基础设施阶段记录不再继续平铺在主入口。
- `ops/archive/` 现在承担历史运维审计材料归档职责；旧材料优先归档，不直接删除。
- `2026-06-12` Cloudflare 源站封口状态已更新：
  - `canvas.hhh2121.xyz` 与 `canvas-next.hhh2121.xyz` 已补齐 `cloudflare-only.conf`，源站 HTTPS 直打均返回 `403`
  - `hermes.hhh2121.xyz` 继续保持已存在的 Cloudflare 源站封口与 Access 保护
  - `files.hhh2121.xyz` 在用户切为橙云后也已完成封口：公网静态文件访问正常，已知源站 IP 直打真实静态资源路径返回 `403`
  - `files.hhh2121.xyz/healthz` 仍可返回 `200`，这是健康检查例外路径，不代表静态文件可以继续被绕过
  - 服务器本机短时可能因 DNS/递归缓存尚未收敛，访问 `files.hhh2121.xyz` 时出现假性 `403`；该现象不代表公网异常
  - 随后 `Provider Files` 公网出口也已完成收口：
    - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN` 在灰度和正式都改为 `https://files.hhh2121.xyz`
    - Provider 文件签名 URL 已升级为带环境 scope 的格式：
      - `/api/provider-files/gray/...`
      - `/api/provider-files/production/...`
    - `files.hhh2121.xyz` Nginx 已按 scope 分流到 `18200` 与 `18100`
    - 旧裸 IP `http://101.33.75.38/api/provider-files/...` 不再直接出内容，而是 `302` 跳转到 `files.hhh2121.xyz`
    - 灰度/正式图像代理真实脚本验收与灰度视频代理验收均已通过
- `2026-06-12` 视频生成 `Unexpected token '<'` 前端误报修复已进入灰度：
  - 前端 `apps/web/src/services/generation.ts` 已统一改为 `readJsonResponse`，不再在生成服务里直接 `await r.json()`
  - 当前灰度 release：
    - `20260612-generation-json-guard-gray-r1`
  - 灰度验收已确认：
    - `canvas-next.hhh2121.xyz/api/status` 正常
    - 未登录 `POST /api/proxy/external/video` 返回 `401 AUTH_REQUIRED` 且 `Content-Type=application/json`
    - 灰度前端打包产物已包含“返回了 HTML 页面，请检查登录状态、网关代理或上游配置”提示文案
  - 本机验收时要注意：
    - `verify:external-video-proxy` 与 `verify:single-port` 不能并行跑在 file-based local 环境上，否则可能因 admin 数据文件互相覆盖而产生假性 `Provider 不存在`
- `2026-06-12` 视频节点 `Unexpected token '<'` 的后端兜底修复已继续进入灰度：
  - 当前灰度 release：
    - `20260612-video-upstream-json-guard-gray-r2`
  - 新判断：
    - 当前灰度/正式运行进程都已经加载 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=https://files.hhh2121.xyz`
    - 使用真实签名规则生成的 `https://files.hhh2121.xyz/api/provider-files/gray/...` 已实测返回 `200 image/png`
    - 因此“橙云切换后导致 Provider 参考图外链天然不可用”不再成立，不能继续把该报错笼统归因到橙云
  - 当前更准确的结论是：
    - 某些视频链路上游仍可能返回 HTML 页面或其它非 JSON 文本
    - 过去后端部分链路存在裸 `JSON.parse(...)`，会把上游异常重新糊成 `Unexpected token '<'`
  - 本轮已补齐后端统一兜底：
    - `apps/api/src/external-proxy.ts`
    - `apps/api/src/server.ts`
    - 统一增加上游 `HTML / 非 JSON` 安全解析与报错归一
  - 新错误文案已经进入灰度产物：
    - `返回网页 HTML，请检查 Base URL、Cloudflare/WAF 或上游鉴权`
    - `返回非 JSON 响应`
  - 后续如果用户再次在灰度复现视频失败，应优先记录：
    - 是哪一个 Provider / 模型
    - 是否带参考图
    - 报错现在落在“提交接口 / 轮询接口 / 最终结果接口”的哪一段
- `2026-06-12` 同一视频上游响应兜底已同步到正式环境：
  - 用户继续看到 `Unexpected token '<', "<!DOCTYPE"... is not valid JSON` 的直接原因是：
    - 用户实际复现发生在正式环境
    - 正式环境当时仍停在 `20260612-video-html-json-guard-r1`
    - 正式前端已有 `readJsonResponse`，但正式后端缺少 `parseUpstreamJson`
    - 因此后端裸 `JSON.parse(...)` 的原生错误被包进 JSON `error` 字段，再由前端显示
  - 当前正式 release：
    - `20260612-video-upstream-json-guard-prod-r1`
  - 正式验收：
    - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260612-video-upstream-json-guard-prod-r1`
    - `xinghuan-canvas.service` / `xinghuan-canvas-worker.service` 均为 `active`
    - `https://canvas.hhh2121.xyz/api/status` 返回 `environment=production`
    - 未登录 `POST /api/proxy/external/video` 返回 JSON `AUTH_REQUIRED`，不是 HTML
    - `https://files.hhh2121.xyz/api/provider-files/production/...` 真实签名 URL 返回 `200 image/jpeg`
  - 后台“能生成”不等价于画布带参考图真实生成：
    - 当前后台模型连通性测试不会自动执行付费视频生成
    - 画布视频节点会额外携带参考图、首帧/尾帧、`providerParams.modelRecordId`
    - 若后续同一节点仍失败，应以新的具体错误文案继续定位是哪一段上游响应异常

边界说明：

- `D:/codex/服务器/无限画布/MEMORY.md` 是旧主干/历史入口，不再代表当前 2.0 最新状态
- 如出现两个记忆文件内容冲突，以当前 worktree 下本文件为准
