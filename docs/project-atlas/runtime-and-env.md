# 运行环境与部署边界

## 环境分层

- 本地开发
  - 当前 worktree：`D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`
- 灰度
  - 域名：`canvas-next.hhh2121.xyz`
  - 端口：`127.0.0.1:18200`
- 生产
  - 域名：`canvas.hhh2121.xyz`
  - 端口：`127.0.0.1:18100`

## 当前服务器

- 主机：`101.33.75.38`
- SSH 用户：`ubuntu`
- SSH 端口：`728`
- 关键说明：
  - 不直接使用 `root`
  - 不修改内部代理项目

## 灰度部署目录

```text
/opt/apps/xinghuan-canvas-next/
  current -> 当前 release
  releases/<release-id>/
  shared/
    canvas-next.env
    data/
    logs/
```

## 生产部署目录

```text
/opt/apps/xinghuan-canvas/
  current -> 当前 release
  releases/<release-id>/
  shared/
    canvas.env
    data/
    logs/
```

## 核心运行组件

- PostgreSQL
  - 持久化用户、画布、资源、任务、后台配置
- Redis
  - 异步任务队列
- API 服务
  - 单端口统一入口
- Worker 服务
  - 队列消费与上游执行
- Nginx
  - 站点入口与反向代理

## 环境变量边界

真实密钥只允许放在：

- 服务器环境文件
- 安全密钥管理系统
- 后台加密字段

不允许放在：

- Git
- 文档
- 日志
- 截图
- 聊天输出

## 发布关键点

- 本地先执行：
  - `npm run build:single-port`
  - `npm run verify:release-package-contract`
  - `npm run package:release -- <release-id>`
- 服务器 release 目录执行 `npm run db:migrate` 前，先加载：
  - `shared/canvas-next.env`
  - 或 `shared/canvas.env`
- 未加载环境就迁移，容易出现假性 `DATABASE_NOT_CONFIGURED`

## 运行态判断

优先看：

1. `ops/README.md`
2. `MEMORY.md`
3. 当前 release 对应的 `ops/*gray*.md` / `ops/*prod*.md`

不要只看旧 runbook 或旧灰度文档顶部判断现在的 release。
