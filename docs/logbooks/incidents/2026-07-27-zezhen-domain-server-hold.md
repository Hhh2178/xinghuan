# zezhen.online 公网不可访问事件

- 发现时间：`2026-07-27`
- 影响：`canvas-next.zezhen.online`、`canvas.zezhen.online` 和 `files.zezhen.online` 公网域名不可解析；浏览器表现为连接关闭。
- 影响范围：公网入口；新服务器内部服务和 Production/Gray 进程未被停止。

## 证据

- 公共 DNS `1.1.1.1`、`8.8.8.8` 对 `zezhen.online` 返回 `NXDOMAIN`。
- RDAP 显示域名状态为 `server hold`，权威 NS 当前为 `wood.dnspod.net`、`bee.dnspod.net`；最近变更时间为 `2026-07-27T07:01:01Z`。
- 新服务器 `43.131.246.222`：Nginx、Gray API、Gray Worker 均 `active`，`nginx -t` 通过。
- 使用 `curl --resolve canvas-next.zezhen.online:443:43.131.246.222` 直连验证返回 `0.8.2 / gray / enforced`。

## 结论

根因在域名注册商/DNS 委派层，不在应用、Nginx、TLS 或新服务器防火墙。`server hold` 必须先由 DNSPod/注册商解除，单纯在服务器上重启服务不会恢复公网访问。

## 恢复动作

1. 在 DNSPod/注册商完成域名实名、付款或安全审核，解除 `server hold`。
2. 确认权威 NS 委派与 DNSPod 控制台一致。
3. 创建以下 A 记录，目标均为 `43.131.246.222`：`canvas`、`canvas-next`、`files`。
4. 等待公共 DNS 收敛后复核三个域名的 HTTPS `/api/status`、证书和 Provider 文件回抓。

旧域名 `canvas-next.hhh2121.xyz` 仍可访问，但指向旧 Gray `0.8.1`，不能作为新服务器修复的替代记录。
