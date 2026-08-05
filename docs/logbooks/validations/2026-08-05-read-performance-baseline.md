# Read Performance Baseline

状态：工具已就绪，等待旧服务器 Gray 只读测量。

执行命令：

```text
npm run measure:read-performance -- --base-url=$env:XINGHUAN_GRAY_BASE_URL --scenario=all
```

约束：仅 GET 和登录请求；报告只保留聚合耗时、响应体大小、状态码和请求计数，不保存 Cookie、凭据、响应正文或用户内容。

记录项：

- cold 10 次、warm 50 次；
- endpoint、P50/P95/P99、响应体 P50/P95/P99；
- 请求总数、重复请求数；
- Gray 进程 RSS、heap、FD、event-loop delay、数据库连接数和 Swap 由授权运行手册补录。

当前结论：未执行服务器测量，不得据此放行阶段 A。
