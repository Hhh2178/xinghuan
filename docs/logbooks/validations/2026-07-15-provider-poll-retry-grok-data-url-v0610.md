# v0.6.10 Provider 轮询重试与 Grok FAST Data URL 验证

> 后续纠正：真实公网 URL 与 Data URL 三图任务均失败，证明传输方式不是充分修复。FAST 的直接问题是错误复用了 Preview 的 `seconds/size/images` 字段；`v0.6.11` 已改为插件一致的通用请求契约，见 `2026-07-15-aifork-grok-fast-contract-v0611.md`。

## 范围

- 环境：gray
- 版本：`v0.6.10`
- 目标模型：`grok-imagine-video-1.5-fast`
- 目标 Provider：协议 `aicopy`、Host `api.aicopy.top`
- Production 保持 `v0.5.22`。
- 本验证不调用付费模型。

## FAST 多参考图 403 根因

- 失败任务：`task-1784104393381-l4rz1q`、`task-1784104583697-yvh9pl`。
- 两次失败均为上游内部第 3 张参考图上传返回 `403`。
- 三张签名 URL 在失败时均未过期，素材均为 `941x1672` RGB PNG，单图约 1.88-2.05 MB。
- Nginx 访问证据显示 AIFork/Grok 已成功下载三张素材，均返回 200。
- 因此问题不在我方上传、签名、Cloudflare、素材格式或 TTL；失败点位于 AIFork 后续向 Grok 内部素材接口的上传阶段。
- 失败任务不会自动重新提交，避免重复计费。

## 修复设计

- 保持 FAST 最大参考图数量为 6，不收窄模型能力。
- 将参考图传输方式建模为模型级显式配置：`url` 为默认值，`data_url` 仅对需要的模型开启。
- API 队列任务和数据库继续保存签名 URL；Worker 提交前才把经过所有权校验的本地素材转为 Data URL。
- 转换只接受当前账号 `input/output` 素材和受控 provider-file URL，并限制 PNG、JPEG、WebP、GIF。
- Base64 不进入任务 payload、数据库、请求摘要或日志。
- 旧模型和未开启该能力的模型继续使用原有公网 URL，不受影响。

## 轮询重试边界

- 只处理幂等 GET；生成 POST 永不重试。
- 可重试范围：网络错误、`408`、`425`、`429` 和 `5xx`。
- 初次请求后最多重试 4 次，退避约为 1.5、3、6、12 秒并带 jitter。
- 重试不越过任务轮询截止时间；`Retry-After` 受上限保护。
- 诊断信息遮蔽查询参数、Bearer 和 token；恢复后清理旧错误字段。

## 自动化证据

- 全工作区类型检查：通过。
- `npm run build:single-port`：通过。
- `npm test`：22 个测试文件、70 项测试通过。
- `npm run lint`：0 error；200 个既有 warning 未扩大。
- `npm run harness:verify:project`：通过。
- `npm run harness:verify:workspace`：通过。
- release version alignment：通过。
- release package contract：通过。
- CodeGraph：已同步。

## 免费运行证据

- 轮询 Mock：`submitCount=1`、第一次 poll=502、第二次 poll=200、任务最终成功。
- 数据库记录：`pollRetryCount=1`，并有恢复时间。
- 三图 Mock：`submitCount=1`、`pollCount=2`、`contentCount=1`、`imageCount=3`、`imageTransport=data_url`。
- 三图 Mock 请求：`seconds="6"`、`size="720x1280"`。
- 数据库任务 payload：保留 3 条签名 URL，不含 `data:image`。
- 临时验证 Provider 已清理，计数为 0。

## 灰度运行与视觉证据

- Gray current 指向 `20260715-provider-poll-retry-grok-data-url-v0610`。
- API、Worker 服务均为 active。
- 内网与公网状态：`0.6.10 / gray`。
- 后台 FAST 输入能力：参考图模式已开启，最大数量 6，传输方式 `Data URL`。
- `1920x1080`、AI 助手开启：页面与参考图卡片均无横向溢出。
- `1920x1080`、AI 助手关闭：页面与参考图卡片均无横向溢出。
- 浏览器控制台：0 error。
- Production current 仍指向 `20260702-envsync-admin-sections-prod-r1-v0522`，公网状态为 `0.5.22 / production`。
