# 2026-08-04 RunningHub 局部抽屉修复

## 本次变更

- 移除 RunningHub 分组筛选的全屏 backdrop、页面模糊和旧 modal 语义。
- 抽屉继续锚定左侧 rail track，增加 document-level pointerdown 外部关闭，并保留 Escape/关闭按钮。
- Admin 信息架构文档同步为 rail-local、右侧编辑区保持清晰可操作。

## 验证证据

- `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx`：4 tests passed。
- `npm run type-check -w @xinghuan/admin`：通过。
- `npm run build -w @xinghuan/admin`：通过。
- `git diff --check`：通过。
- 视觉目标：`1920x1080`；待 Gray 浏览器验收确认实际点击、Escape 和外部关闭行为。

## 发布边界

- 本次只涉及 Admin 局部抽屉，不修改 Production。
- RH 输出归档队列仍按独立实施计划推进。
