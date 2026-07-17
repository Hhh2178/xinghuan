# v0.7.1 权限、归属与文本拆分 Gray 发布

## 发布信息

- release：`20260717-permission-owner-textsplit-gray-r2-v071`
- source commit：`afc325232a7d78a453e4d76ca050fe69c233bd6b`
- 发布包：`dist-release/20260717-permission-owner-textsplit-gray-r2-v071.tar.gz`
- SHA-256：`34901e391c74638145347b6c8a0b22650c8baef1c41937e9234e02dc884bf8fe`
- 回滚：`20260717-permission-owner-textsplit-gray-r1-v071`
- Production：保持 `v0.7.0`，本批次未触碰。

## 发布内容

- PostgreSQL 用户目录写入改为定点 repository，用户组创建和权限策略保存不再全量替换用户表。
- 权限 Subject/Rule 写入加入语义比较、revision 冲突反馈和安全重试。
- 任务 owner 解析支持主外键与任务内嵌 `userId` 回退；RunningHub 新旧入口均保留提交者快照。
- 文本拆分重跑使用稳定 ID 原位协调，保留已有输出节点的位置、顺序和下游边。
- 审计页现有账号/分组统计能力完成本批次真实数据复验：支持模型与 RunningHub 调用总数、账号下钻及分组排行。

## 数据保护

- 发布前 Gray 全库备份：`/opt/apps/xinghuan-canvas-next/shared/backups/20260717-permission-owner-textsplit-gray-r1-v071.dump`。
- 备份大小 `8,804,060` bytes，`pg_restore --list` 通过。
- 发布前后用户、画布、素材 ID 集合哈希完全一致；用户 `28`、画布 `9`、素材 `1`。
- 任务由 `432` 增至 `446`，增量为两轮分页验收各写入的 7 条测试任务，无旧任务丢失。

## 结果

- API 与 Worker active；内外网 `/api/status` 均为 `v0.7.1 / gray / enforced`。
- readiness：127 Subjects、121 published、3 restricted、3 retired、926 rules、5 principals、0 failures。
- 用户组创建、默认策略保存与清理完成，关键业务 ID 哈希保持不变。
- 专用 canary 守护进程在 Windows 打包环境无法启动，改用 Playwright 验收；登录页标题、主视觉和输入控件完整，控制台 0 error / 0 warning。
- `v0.7.0` 含已修复的全量替换路径，不作为直接业务回滚目标；若必须越级回滚，应先冻结用户组与旧权限策略写入。
