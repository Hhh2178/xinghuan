# 部署与运行状态

## 服务器边界

- 主机：`101.33.75.38`
- SSH 用户：`ubuntu`
- SSH 端口：`728`
- 不直接使用 `root`
- 不修改内部代理项目

## 部署目录

### 灰度

- `/opt/apps/xinghuan-canvas-next/`
- `current -> releases/<release-id>/`

### 生产

- `/opt/apps/xinghuan-canvas/`
- `current -> releases/<release-id>/`

## 核心运行组件

- PostgreSQL
- Redis
- API 服务
- Worker 服务
- Nginx

## 发布边界

- release 目录执行 `db:migrate` 前必须先加载共享环境文件
- 真实密钥只允许留在服务器环境文件、密钥系统或后台加密字段
- 当前 release 包仍需注意 runtime-only 打包的限制

## 相关入口

- `../../ops/README.md`
- `../project-atlas/runtime-and-env.md`
