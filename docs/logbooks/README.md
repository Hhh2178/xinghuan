# 台账与证据

这里用于存放逐日推进、发布记录、验证记录和事故记录。

## 目录说明

- `daily/`：按日期记录日常推进
- `releases/gray/`：灰度发布记录
- `releases/production/`：正式发布记录
- `validations/`：专项验证与验收
- `incidents/`：线上问题、回滚与事故闭环

## Phase 1 现状

- `DEVLOG.md` 与 `ops/README.md` 仍保留为兼容入口
- 从本轮开始，新的逐日台账应优先进入 `daily/`
- 当前已建立：
  - `daily/2026/`
  - `releases/README.md`
  - RunningHub gray / production 索引样例
  - 本轮治理验证记录

## 新增记录命名

- 日常台账：`YYYY-MM-DD.md`
- 发布记录：`YYYY-MM-DD-<topic>.md`
- 验证记录：`YYYY-MM-DD-<topic>.md`
- 事故记录：`YYYY-MM-DD-<topic>.md`
