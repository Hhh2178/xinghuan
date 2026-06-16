# files.hhh2121.xyz 切换与封口执行清单 - 2026-06-12

## 本次执行结果

本清单对应动作已完成，最终结果如下：

- `files.hhh2121.xyz` 已切换为 Cloudflare 橙云
- `files.hhh2121.xyz` vhost 已启用 `cloudflare-only.conf`
- 公网验证：
  - `https://files.hhh2121.xyz/images/smoke.txt` => `200`
  - `https://files.hhh2121.xyz/healthz` => `200`
- 源站直打验证：
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt` => `403`
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/healthz` => `200`

补充说明：

- `/healthz` 继续返回 `200` 是预期行为，因为该路径本身就是健康检查例外，不用于证明静态资源是否仍可绕过。
- 服务器本机如仍短时把 `files.hhh2121.xyz` 解析到旧源站 IP，访问域名时可能出现假性 `403`，属于 DNS 缓存未收敛，不代表公网异常。

本清单用于把 `files.hhh2121.xyz` 从当前“灰云直连、未封口”状态，推进到“橙云代理、源站封口”的可执行流程。

## 当前基线

本次整理前确认到的真实状态：

- 服务器侧解析：
  - `files.hhh2121.xyz -> 101.33.75.38`
- 公网访问：
  - `https://files.hhh2121.xyz/images/smoke.txt` => `200`
- 强制直打源站：
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt` => `200`

结论：

- 当前 `files.hhh2121.xyz` 仍是灰云直连
- 当前还不能直接给 `files` vhost 启用 `cloudflare-only.conf`

## 执行目标

完成后应达到：

1. 公网用户访问 `https://files.hhh2121.xyz/...` 仍正常
2. `files.hhh2121.xyz` 权威解析不再暴露 `101.33.75.38`
3. 已知源站 IP 无法再直接绕过访问该域名

## 阶段 1：切换前检查

在 Cloudflare 控制台动手前，先确认以下基线：

### DNS 基线

- Cloudflare 控制台中 `files.hhh2121.xyz` 当前状态确认为灰云 / `仅 DNS`
- 记录值确认仍是：
  - `101.33.75.38`

### 公网访问基线

执行：

```powershell
curl.exe -sS -D - https://files.hhh2121.xyz/images/smoke.txt -o -
```

预期：

- `HTTP/1.1 200 OK`
- 能返回 `shared-media-smoke`

### 源站绕过基线

执行：

```powershell
curl.exe -k -sS -D - --resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt -o -
```

预期：

- `HTTP/1.1 200 OK`
- 能返回 `shared-media-smoke`

这一步是为了确认“当前确实未封口”。

## 阶段 2：Cloudflare 切换动作

在 Cloudflare DNS 中：

1. 找到 `files.hhh2121.xyz`
2. 把代理状态从灰云切到橙云
3. 保持记录值仍指向：
   - `101.33.75.38`
4. TTL 维持自动即可

## 阶段 3：切换后等待与确认

切换后不要立刻改 Nginx，先确认 DNS 已真正生效。

### 本机检查

执行：

```powershell
Resolve-DnsName files.hhh2121.xyz
```

如果本机环境存在特殊 DNS 劫持或本地代理，结果可能不是公网真实结果，因此只作参考。

### 服务器侧检查

执行：

```bash
python3 - <<'PY'
import socket
print(socket.gethostbyname_ex('files.hhh2121.xyz')[2])
PY
```

预期：

- 不再是 `101.33.75.38`
- 应切为 Cloudflare 边缘 IP

### 公网访问检查

执行：

```powershell
curl.exe -sS -D - https://files.hhh2121.xyz/images/smoke.txt -o -
```

预期：

- 仍返回 `200`
- 文件内容仍为 `shared-media-smoke`
- 若响应头出现 `Server: cloudflare` 更好，但不把它作为唯一判据

## 阶段 4：启用源站封口

只有在“服务器侧解析已不再直指 `101.33.75.38`”后，才能执行这一步。

目标文件：

- `/etc/nginx/sites-available/files.hhh2121.xyz.conf`

需要加入：

```nginx
include /etc/nginx/snippets/cloudflare-only.conf;
```

建议位置：

- `server_name files.hhh2121.xyz;` 下一行

若需要覆盖 HTTP 与 HTTPS 两个 server block，则都加。

执行后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 阶段 5：封口后验收

### 公网访问仍正常

执行：

```powershell
curl.exe -sS -D - https://files.hhh2121.xyz/images/smoke.txt -o -
```

预期：

- `HTTP 200`
- 内容仍为 `shared-media-smoke`

### 源站直打已失败

执行：

```powershell
curl.exe -k -sS -D - --resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt -o -
```

预期：

- `HTTP 403`

### 健康检查确认

执行：

```powershell
curl.exe -sS -D - https://files.hhh2121.xyz/healthz -o -
```

预期：

- `HTTP 200`
- 返回 `ok`

注意：

- `healthz` 是 `return 200` 的简单检查，不足以单独证明静态文件访问可用
- 一定要以 `/images/smoke.txt` 这类真实静态文件路径作为最终验收

## 阶段 6：业务影响检查

封口后补做以下业务侧确认：

1. 前端是否还能正常加载任何引用到 `files.hhh2121.xyz` 的公开资源
2. 若后台或其他系统里有直接引用 `https://files.hhh2121.xyz/images/...` 的外链，确认仍可访问
3. 再次确认 `provider-files` 现有链路未变：
   - `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN` 仍保持当前值
   - 不因为 `files` 封口而误以为可以把 Provider 回抓切到 `files`

## 回滚条件

若出现以下任一情况，应立即回滚：

1. `https://files.hhh2121.xyz/images/smoke.txt` 由 `200` 变为 `403`
2. 任意真实静态文件访问异常
3. 前端已有文件外链出现大面积失效

回滚方式：

1. 先从 `/etc/nginx/sites-available/files.hhh2121.xyz.conf` 删除：
   - `include /etc/nginx/snippets/cloudflare-only.conf;`
2. 执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

3. 如仍异常，再把 Cloudflare 代理状态从橙云切回灰云

## 不要在本次执行中做的事

本次封口执行不要顺手改这些：

- `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN`
- `/api/provider-files/...` 的签名逻辑
- `canvas` / `canvas-next` 已经完成的封口规则
- Hermes 的 Cloudflare Access / origin lock 规则

## 最终操作原则

顺序必须是：

1. 先切 `files` 到橙云
2. 再确认解析真的变了
3. 最后才启用 `cloudflare-only.conf`

不能反过来。
