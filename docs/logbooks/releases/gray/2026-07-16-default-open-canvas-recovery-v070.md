# v0.7.0 默认开放权限与画布恢复 Gray 发布

## 发布信息

- 版本：`v0.7.0`
- 环境：仅 Gray
- release：`20260716-default-open-canvas-recovery-gray-r2-v070`
- source commit：`df0883889b774c1d0fb42d564aa828bf4cc273a1`
- 发布包：`dist-release/20260716-default-open-canvas-recovery-gray-r2-v070.tar.gz`
- SHA-256：`ee0562e49332aaf0866e16fd502898640540e1166df2aadedccf23e9bd0e4f1b`
- 回滚：`20260716-default-open-canvas-recovery-gray-r1-v070`
- Production 保持：`v0.6.13 / 20260716-permission-platform-hardening-prod-r1-v0613`

## 发布内容

- 修复 PostgreSQL 已部分迁移且 marker 存在时孤立画布 JSON 永久不可见的问题；恢复使用事务并保护跨 owner ID 冲突。
- 新组与缺失组策略默认空 deny；已发布权限对象无匹配规则时默认允许，显式 deny 才关闭。
- readiness 不再要求每个组为每个已发布对象生成全量 allow 矩阵。
- 公共资源上传、分类、编辑、删除和发布继续保持管理员硬边界，不进入普通成员授权目录。
- 新增受控默认关闭迁移命令，Gray 只迁移创建时系统生成的测试组全禁策略。
- 图像/视频节点不再显示 provider/protocol/inputProfile 摘要；服务商列表桌面 sticky、视口内滚动。
- 权限后台明确展示默认开放与管理员边界；enforced 就绪状态显示“正常”。

## 数据操作

- 发布前备份：`/opt/apps/xinghuan-canvas-next/shared/backups/20260716-default-open-canvas-recovery-gray-r1-v070`。
- 备份包含权限/画布 SQL dump、4 个画布 JSON 副本和 SHA-256 manifest，校验通过。
- 权限迁移 apply 前唯一候选为测试组，blocked 为 0；apply 后二次 dry-run 候选为 0。
- 测试账号列表请求将 PostgreSQL 画布从 1 恢复为 4，第二次请求仍为 4；原始 JSON 未删除。

## 部署结果

- Gray `current` 指向本 release，API/Worker 均为 active。
- 内网与公网状态为 `0.7.0 / gray / enforced`。
- permission readiness 为 `127 / 123 / 3 / 1 / 942 / 5`，failures 为 0。
- Production release、服务和数据库未修改。

## 已知项

- `npm audit` 仍报告 1 个 low severity dependency issue，本批次不自动升级依赖。
- Admin Vite 主 chunk 仍有既有的 500 kB warning，不阻断本 release。
