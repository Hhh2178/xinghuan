# Admin Rail 单一滚动所有权与 Footer 视觉修复

## 已确认目标

1. Provider 平台列表在页面滚动时不得再发生第二次上移；页面滚动由主内容负责，左侧 rail 只有一个 sticky owner，列表自身只在列表区域内滚动。
2. Provider 的“新增平台”区不再渲染深色渐变色块；保留必要的分隔线和全宽操作按钮。
3. RunningHub 的“工作流”和“AI 应用”目录复用同一透明 footer 规则，不能再出现底部色块。
4. 变更先发布 Gray，再以同一已验证制品发布 Production；不改业务数据、Provider 配置、权限或运行时开关。

## 设计

- `AdminConfigurationLayout` 继续作为配置型页面唯一 sticky rail owner。Provider 和 RunningHub 的内层 rail 不得再声明 `position: sticky`、`top` 或 viewport 高度，改为填充由外层提供的可视高度。
- 内层列表保持 `minmax(0, 1fr)` 与 `overflow-y: auto`，footer 位于 grid 最后一行，因此新增动作持续可见，长列表只滚动中间区域。
- 两个 footer 移除渐变背景，改为透明背景；保留现有上边框和按钮尺寸，避免把视觉修复扩大成操作层重设计。

## 验收

- 自动化测试覆盖 Provider/RH rail 不再包含内层 sticky 声明，footer 不包含渐变背景。
- Admin 构建和相关测试通过。
- Gray/Production 状态接口、API 与 Worker 均报告相同发布版本且服务 active；用户随后进行最终视觉与业务验收。
