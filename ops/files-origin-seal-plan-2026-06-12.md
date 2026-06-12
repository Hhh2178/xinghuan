# files.hhh2121.xyz 完整封口方案 - 2026-06-12

## 当前执行状态

本方案现已完成第一阶段落地：

- 用户已将 `files.hhh2121.xyz` 切换为 Cloudflare 橙云
- 服务器 `files.hhh2121.xyz` vhost 已加入：
  - `include /etc/nginx/snippets/cloudflare-only.conf;`
- 公网静态文件访问保持正常
- 已知源站 IP 直打真实静态文件路径已返回 `403`

当前仍保留的注意点：

- 服务器本机解析 `files.hhh2121.xyz` 时，短时间内可能因为本地 DNS/递归缓存未刷新，仍看到旧源站 IP，导致本机访问该域名返回假性 `403`
- 这属于本机缓存收敛问题，不代表公网用户链路异常
- Provider 回抓素材链路仍未迁出裸 IP，当前继续依赖：
  - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38`

## 背景

当前主站与灰度站已经完成 Cloudflare 源站封口：

- `canvas.hhh2121.xyz`
- `canvas-next.hhh2121.xyz`
- `hermes.hhh2121.xyz`

但 `files.hhh2121.xyz` 还没有封口。原因不是遗漏，而是该域名与当前上游 Provider 回抓素材链路的职责不同，不能直接套用同一策略。

## 当前职责拆解

### 1. `files.hhh2121.xyz`

当前是独立静态文件站，对应服务器目录：

- `/opt/apps/shared-media/public/images/`
- `/opt/apps/shared-media/public/audio/`
- `/opt/apps/shared-media/public/video/`
- `/opt/apps/shared-media/public/docs/`
- `/opt/apps/shared-media/public/tmp/`

当前 Nginx vhost：

- `/etc/nginx/sites-available/files.hhh2121.xyz.conf`

它提供的是公开静态资源读取能力，不是当前 Provider 回抓参考图的主入口。

### 2. Provider 回抓参考素材链路

当前生产/灰度里，外部图像/视频/LLM Provider 获取本地参考素材时，走的是：

- `/api/provider-files/...`

签名 URL 由：

- `apps/api/src/provider-file-access.ts`
- `apps/api/src/server.ts`

共同生成。

公网 origin 由环境变量决定：

- `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN`

当前实际策略已经明确：

- 为避免 Cloudflare 挑战页拦截上游服务商机器回抓，Provider 回抓默认改走直连源站
- 当前记录值为：
  - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38`

因此：

- `files.hhh2121.xyz` 不是当前 Provider 回抓的关键入口
- `canvas/api/provider-files` 才是

## 当前风险

### 风险 A：`files.hhh2121.xyz` 当前仍暴露源站 IP

服务器侧解析结果表明：

- `files.hhh2121.xyz -> 101.33.75.38`

因此当前 `files` 仍是灰云直连，任何人都可以直接获知源站 IP。

### 风险 B：不能直接给 `files` 套 Cloudflare 白名单

如果在 `files.hhh2121.xyz.conf` 上直接加入：

- `include /etc/nginx/snippets/cloudflare-only.conf;`

会出现：

- 因该域名当前仍是灰云
- 真实静态文件访问直接命中源站
- Nginx 把请求当作“非 Cloudflare 来源”拦为 `403`

这会直接打断：

- `https://files.hhh2121.xyz/images/...`
- `https://files.hhh2121.xyz/audio/...`
- `https://files.hhh2121.xyz/video/...`

## 完整方案目标

目标不是“把 `files` 也一键白名单”，而是同时满足三件事：

1. `files.hhh2121.xyz` 不再公开暴露源站 IP
2. 用户访问静态资源仍正常
3. 上游 Provider 回抓素材链路不被误伤

## 推荐方案

推荐采用 **双链路分离方案**。

### 方案主线

#### A. `files.hhh2121.xyz` 只承担“用户/前端可见静态资源域名”

动作：

1. 把 `files.hhh2121.xyz` 真正切到 Cloudflare 橙云
2. 确认公网 DNS 已解析到 Cloudflare 边缘，而不是 `101.33.75.38`
3. 之后再给 `files.hhh2121.xyz.conf` 加：
   - `include /etc/nginx/snippets/cloudflare-only.conf;`
4. 验证：
   - `https://files.hhh2121.xyz/images/...` 仍返回 `200`
   - `--resolve files.hhh2121.xyz:443:101.33.75.38 ...` 返回 `403`

这样 `files` 站点本身就封住了。

#### B. Provider 回抓继续走独立入口，不复用 `files` 域名

原因：

- 上游服务商是机器回抓，不适合依赖可能出现 challenge / WAF / Access 的用户站点域名
- 当前你们已经通过 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN` 显式把这条链路与普通公网域名拆开了

短期建议：

- 继续保留：
  - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38`
- 保持当前只读直连入口：
  - `http://101.33.75.38/api/provider-files/...`

长期建议：

- 不再让上游回抓走裸 IP
- 改成单独 Provider 素材域名，例如：
  - `provider-files.hhh2121.xyz`
  - 或 `origin-files.hhh2121.xyz`

但注意：

- 如果这个新域名仍灰云并指向同一台 IP，本质上还是会暴露源站 IP
- 所以真正理想的长期解法不是“换个名字的灰云域名”，而是把 Provider 回抓素材迁到独立对象存储或独立出口

## 长期最佳方案

长期最佳方案是 **把 Provider 回抓素材从业务源站剥离**。

推荐顺序：

### 阶段 1

- `files.hhh2121.xyz`
  - 切橙云
  - 加 Cloudflare 源站白名单
  - 成为用户静态资源专用域名

### 阶段 2

- `/api/provider-files/...`
  - 继续保留现有签名逻辑
  - 但把最终素材落地迁到对象存储，例如 R2 / S3 兼容存储
  - 对外发放短时签名 URL

### 阶段 3

- 彻底废弃 `http://101.33.75.38/api/provider-files/...` 作为上游回抓入口
- 让业务主站和素材回抓都不再依赖裸 IP

## 为什么推荐对象存储而不是继续灰云域名

因为灰云域名只是在“裸 IP”外面包了一层名字：

- 仍然暴露同一源站 IP
- 仍然无法真正实现主站与素材站的源站隔离
- 仍然容易在后续安全审计里被识别为旁路入口

对象存储方案的优势：

- 不暴露业务源站
- 天然适合匿名短时下载
- 更适合上游 Provider 的机器回抓
- 后续图片/视频/音频规模增长时更好扩展

## 复杂度评估

### 低复杂度

- 只做 `files.hhh2121.xyz` 橙云化 + Nginx 白名单封口
- 不改 Provider 回抓链路
- 可以很快落地

代价：

- `provider-files` 仍依赖裸 IP
- 只是把用户静态资源站封住了，不是全链路最终形态

### 中复杂度

- `files` 封口
- 新增独立 Provider 回抓域名
- 仍走同台服务器，只做用途隔离

代价：

- 架构比现在清楚
- 但若新域名仍灰云同 IP，安全收益有限

### 高复杂度，但最优

- `files` 封口
- Provider 回抓迁到对象存储 / 独立可签名下载服务
- 业务源站不再承担匿名素材回抓出口

代价：

- 需要补对象存储接入和迁移
- 但这是长期最合理的生产架构

## 当前推荐决策

如果目标是“先尽快把明显暴露面收住，同时不打断现网”，推荐：

1. 先把 `files.hhh2121.xyz` 真正切到橙云
2. 等权威解析确认已变为 Cloudflare 边缘 IP 后
3. 再给 `files.hhh2121.xyz` 增加 `cloudflare-only.conf`
4. Provider 回抓链路短期不动，继续走现有 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38`
5. 下一阶段再单独做“Provider 回抓素材脱离裸 IP”的对象存储改造

## 实施前检查清单

在真正封 `files` 之前，必须先确认：

1. `files.hhh2121.xyz` 权威 DNS 已不再返回 `101.33.75.38`
2. 服务器自身解析 `files.hhh2121.xyz` 也已走 Cloudflare 边缘 IP
3. 公网访问：
   - `https://files.hhh2121.xyz/images/smoke.txt` 返回 `200`
4. 直打源站：
   - `--resolve files.hhh2121.xyz:443:101.33.75.38` 当前仍返回 `200`
   - 这时再启用 `cloudflare-only.conf`
5. 启用后重新验收：
   - 公网文件访问仍 `200`
   - 源站直打返回 `403`

## 本方案结论

`files.hhh2121.xyz` 的完整封口不能和 `canvas` 站点一样粗暴处理。  
正确做法是：

- 先把它和 Provider 回抓职责完全分开理解
- 再把 `files` 作为用户静态域名单独橙云化并封口
- 最后把 Provider 回抓链路迁离裸 IP
