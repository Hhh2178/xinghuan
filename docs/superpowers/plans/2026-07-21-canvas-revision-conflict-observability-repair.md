# 画布 Revision Conflict 与生产告警修复计划

## 目标

- 减少同一浏览器多标签编辑导致的可预防 canvas revision conflict。
- 保留服务端乐观锁，禁止用覆盖写或删除审计记录消除告警。
- 将 revision conflict 健康等级从固定次数改为可解释的历史基线判断。

## 实施

1. 用纯函数测试锁定 revision notice 的 ignore / reload / block 决策。
2. 使用 Web Locks 串行化同一浏览器的同画布保存请求。
3. 保存成功后通过 BroadcastChannel 广播 revision；干净标签重载，脏标签暂停。
4. 提取 audit observability domain，使用 7d/30d 日均、影响对象数、1.25x warning 与 2x critical 阈值。
5. API 返回 24h distinct target / actor 计数，Admin 类型同步。

## 验证

- 新增 domain 与前端协调器单元测试。
- API/Web/Admin 类型检查与 production build。
- 全量 CI、热点文件、CodeGraph 与 Release Harness。
- Gray 双标签实机保存、系统健康响应、revision conflict 计数与日志验证。

## 发布边界

- 按 PATCH 规则从当前 Gray 版本递增 `0.0.1`。
- 先推 Gray；Production 仅在 Gray 实机验收通过并再次核对 canonical state 后晋级。
