# 台账与证据

这里用于存放逐日推进、发布记录、验证记录和事故记录。

## 目录说明

- `daily/`：按日期记录日常推进
- `releases/gray/`：灰度发布记录
- `releases/production/`：正式发布记录
- `validations/`：专项验证与验收
- `incidents/`：线上问题、回滚与事故闭环

## 当前结构

- `DEVLOG.md` 与 `ops/README.md` 仍保留为兼容入口
- 从本轮开始，新的逐日台账应优先进入 `daily/`
- 当前已建立：
  - `daily/2026/`
  - `daily/2026/2026-07/README.md`
  - `daily/2026/2026-07/recent-highlights.md`
  - `releases/README.md`
  - `releases/current-release-index.md`
  - RunningHub gray / production 索引样例
  - 本轮治理验证记录

## 当前值守建议

- 日常推进先看当前月份目录中的 `recent-highlights.md`，当前为 `daily/2026/2026-07/recent-highlights.md`
- 当前发布状态先看 `releases/current-release-index.md`
- 旧兼容入口只在需要追溯老路径时回看 `DEVLOG.md` 和 `ops/README.md`
- 若新增真实 gray / production 发布记录，同一次提交还应同步 `ops/README.md` 与 `ops/current/*.md`
- 即使没有新 release 记录，`releases/current-release-index.md` 与 `ops/current/*.md` 也应保持一致

## 新增记录命名

- 日常台账：`YYYY-MM-DD.md`
- 发布记录：`YYYY-MM-DD-<topic>.md`
- 验证记录：`YYYY-MM-DD-<topic>.md`
- 事故记录：`YYYY-MM-DD-<topic>.md`

## 索引契约

- 当前月份目录必须存在 `README.md`、`recent-highlights.md` 和当天记录。
- `recent-highlights.md` 只能提供导航和历史摘要；版本、release、环境和部署状态必须链接到 canonical state。
- 使用 `npm run verify:logbook-index-contract` 检查当前月份入口和当天记录是否存在。
