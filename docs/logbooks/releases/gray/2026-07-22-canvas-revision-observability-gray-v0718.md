# 画布 Revision 协调与观测基线 Gray v0.7.18

- release：`20260722-canvas-revision-observability-gray-r1-v0718`
- source commit：`5fd2b5d`
- archive：`20260722-canvas-revision-observability-gray-r1-v0718.tar.gz`（1.82 MiB）
- 回滚：`20260721-admin-health-visual-resource-domain-gray-r1-v0717`

## 变更

- 同一浏览器多标签保存使用 Web Locks 串行化；保存成功通过 BroadcastChannel 广播新 revision。
- 干净标签自动读取远端新版本；有本地改动的标签在请求前暂停保存，继续由服务端 optimistic revision lock 保护。
- revision conflict 健康评估改用 7d/30d 日均基线、1.25x/2x 阈值和受影响对象数，消除固定“超过 5 次即 critical”的误报。
- API 返回 24h distinct target/actor 观测字段，Admin 类型和健康页数据契约同步。

## 环境边界

- 本轮只部署 Gray，Production 保持 `v0.7.17 / 20260721-admin-health-visual-resource-domain-prod-r1-v0717`，未部署、未重启、未改配置。
- Gray 任务健康当前为 critical，原因是 24h 仅 12 个完成样本中 8 个失败；该事实保留用于后续业务失败治理。
