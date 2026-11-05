# 服务器维护与健康检查手册

> 兼容说明：本页继续保留为旧正文，新的主入口优先看 `docs/systems/observability-and-ops/gray-and-production-operations.md`、`docs/memory/deployment-state.md`、`ops/README.md`。

## 适用范围

本手册用于当前无限画布 2.0 的服务器维护、日常检测、发布后复核和常见故障入手。

它不替代：

- 灰度/生产发布 Runbook
- 单次 gray / production 发布记录
- 单次回滚记录

它的职责是告诉协作者：

- 先连哪台机器
- 先看哪些服务
- 先跑哪些健康检查
- 发现异常后按什么顺序缩小范围

## 当前服务器概况

- 服务器：`101.33.75.38`
- 用户：`ubuntu`
- SSH 端口：`728`
- 灰度入口：
  - 域名：`canvas-next.hhh2121.xyz`
  - 本机端口：`127.0.0.1:18200`
- 生产入口：
  - 域名：`canvas.hhh2121.xyz`
  - 本机端口：`127.0.0.1:18100`

## 连接方式

```bash
$sshKey = (Resolve-Path '..\Server\Tencent_Cloud_Server.pem').Path
ssh -i $sshKey -p 728 ubuntu@101.33.75.38
```

要求：

- 不直接用 `root`
- 不输出真实密钥
- 不修改内部代理项目

## 当前目录

### 灰度

```text
/opt/apps/xinghuan-canvas-next/
  current -> 当前 release
  releases/<release-id>/
  shared/
    canvas-next.env
    data/
    logs/
```

### 生产

```text
/opt/apps/xinghuan-canvas/
  current -> 当前 release
  releases/<release-id>/
  shared/
    canvas.env
    data/
    logs/
```

## 服务清单

### 灰度

- `xinghuan-canvas-next.service`
- `xinghuan-canvas-next-worker.service`

### 生产

- `xinghuan-canvas.service`
- `xinghuan-canvas-worker.service`
- `xinghuan-canvas-output-prune.timer`

### 公共基础设施

- `postgresql.service`
- `redis-server.service`
- `nginx.service`

## 日常健康检查顺序

### 第 1 步：确认 current 指针

灰度：

```bash
readlink -f /opt/apps/xinghuan-canvas-next/current
```

生产：

```bash
readlink -f /opt/apps/xinghuan-canvas/current
```

### 第 2 步：确认服务存活

灰度：

```bash
systemctl status xinghuan-canvas-next --no-pager
systemctl status xinghuan-canvas-next-worker --no-pager
```

生产：

```bash
systemctl status xinghuan-canvas --no-pager
systemctl status xinghuan-canvas-worker --no-pager
systemctl status xinghuan-canvas-output-prune.timer --no-pager
```

公共：

```bash
systemctl status postgresql --no-pager
systemctl status redis-server --no-pager
systemctl status nginx --no-pager
```

### 第 3 步：确认本机 API 可用

灰度：

```bash
curl -fsS http://127.0.0.1:18200/api/status
```

生产：

```bash
curl -fsS http://127.0.0.1:18100/api/status
```

### 第 4 步：确认域名入口可用

灰度：

```bash
curl -I -sS https://canvas-next.hhh2121.xyz/api/status
```

生产：

```bash
curl -I -sS https://canvas.hhh2121.xyz/api/status
```

### 第 5 步：确认数据库目标没有打错

灰度：

```bash
set -a
. /opt/apps/xinghuan-canvas-next/shared/canvas-next.env
set +a
psql "$XINGHUAN_DATABASE_URL" -Atc "select current_database();"
```

生产：

```bash
set -a
. /opt/apps/xinghuan-canvas/shared/canvas.env
set +a
psql "$XINGHUAN_DATABASE_URL" -Atc "select current_database();"
```

返回值必须和 `XINGHUAN_EXPECTED_DATABASE_NAME` 一致。

## 发布后标准 gate

### Gray

在 gray current release 目录内：

```bash
cd /opt/apps/xinghuan-canvas-next/current
set -a
. /opt/apps/xinghuan-canvas-next/shared/canvas-next.env
set +a
npm run verify:release-preflight
npm run verify:request-chain-observability
npm run verify:system-observability
```

### Production

在 production current release 目录内：

```bash
cd /opt/apps/xinghuan-canvas/current
set -a
. /opt/apps/xinghuan-canvas/shared/canvas.env
set +a
npm run verify:release-preflight
npm run verify:request-chain-observability
npm run verify:system-observability
```

## 常见异常与第一反应

### 1. 服务 active，但页面异常

优先检查：

- `/api/status` 是否正常
- Nginx 是否 reload 成功
- 当前域名是否指向正确端口
- 前端 bundle 是否已切到当前 release

### 2. `db:migrate` 报 `DATABASE_NOT_CONFIGURED`

根因通常不是代码缺文件，而是：

- 没先加载 `shared/*.env`

### 3. 验收脚本失败，但真实页面正常

优先怀疑：

- 验收脚本没有带 same-origin `Origin`
- 本地/服务器使用了错误 base URL
- 脚本本身残留旧断言或未清理测试对象

### 4. 后台出现测试 Provider / 测试对象

优先怀疑：

- 可写型观测/验收脚本未自清理

## 日志查看

### 灰度

```bash
sudo journalctl -u xinghuan-canvas-next -f
sudo journalctl -u xinghuan-canvas-next-worker -f
```

### 生产

```bash
sudo journalctl -u xinghuan-canvas -f
sudo journalctl -u xinghuan-canvas-worker -f
```

## 禁止事项

- 不批量删除服务器文件或目录
- 不覆盖灰度根目录到生产根目录
- 不把生产环境文件指向灰度 env
- 不把生产数据目录复用灰度 `shared/data`
- 不输出真实密钥、Cookie、数据库连接串

## 相关入口

- 连接与服务器基础信息：`ops/server-connection.md`
- 灰度发布：`ops/gray-deploy-runbook.md`
- 生产发布：`ops/production-deploy-runbook.md`
- 生产验收：`ops/production-acceptance-checklist.md`
- Phase E 放行 gate：`ops/phase-e-observability-release-gate-2026-06-15.md`
- 排障总入口：`docs/project-atlas/debugging-playbook.md`
