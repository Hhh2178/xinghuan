# Permission and Image Node Repair Production v0.7.6 验证

## 结论

- 状态：`PASS_WITH_USER_VISUAL_ACCEPTANCE_PENDING`。
- Production 复用 Gray 的同一不可变制品，大小与 SHA-256 一致。
- 严格 runtime gate 返回 `0.7.6 / production / enforced / readiness=true`；API、Worker、output prune timer active，API/Worker `NRestarts=0`。
- 数据库目标为 `xinghuan_canvas_next`，与 Gray 数据库、数据目录和 Redis 队列隔离。

## 功能与运行态验证

- 真实 Production 图片链路通过：认证登录、上传 PNG、尺寸调整、输出下载均为 200，输出为有效 PNG；两个测试 Artifact 已清理。
- 权限 member catalog 对未分组与已分组用户均通过，模型 40、图片能力 8、视频能力 9、RunningHub 10、被拒节点 0；Production 共享资源真实基线为 0，因此以 `min-resources=0` 复核通过，未修改线上权限规则。
- request-chain observability 覆盖 provider 写入及 8 个管理读取动作；system observability 数据库目标匹配，近 24 小时 requestId 覆盖率 100%。
- Nginx 配置通过；3 轮公网/内网 status 与首页检查零错误，响应头保留指定 requestId。
- Worker 切换时旧进程优雅退出超时并被 systemd 终止；新 Worker 随即 active，`NRestarts=0`，后续严格 runtime、真实图片链路和可观测性门禁均通过。

## 观察项

- 系统面板显示近 24 小时 65 个失败任务、32 个 canvas revision conflict，属于既有累计运行趋势，不是本次 v0.7.6 发布新增故障。
- 用户浏览器视觉以及管理员真实执行“组 deny + 单账号 allow”的交互体验仍待最终确认；resolver、scoped-write contract 与线上 member catalog 已覆盖自动化边界。
- Retention dry-run 与 apply 均确认 current/rollback 为 `v0.7.6` / `v0.7.5`；最终 Production Release 数量为 3，移除旧 `v0.7.3` 并释放 `307,826,688` bytes，未触碰 shared 数据、备份或用户材料。
