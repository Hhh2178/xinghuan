# 画布代码节点、标签节点与组运行增强设计

## 1. 背景

当前画布已有节点注册、画布序列化、公共工作流资源、组执行管理器和运行总线，但存在六类缺口：缺少自定义代码处理节点；缺少纯标注节点；组框不能独立配置循环；批量运行失败后不会重试；模板入口仍是静态下拉；部分工具节点不能被组自动运行；锁定组成员在 mouseup 时仍可能提交新位置。

## 2. 目标

- 让用户在受控 Python 环境中编写数据处理逻辑，并把代码保存为节点内预设。
- 提供无端口的画布标签板。
- 让每个组独立配置循环次数，单节点失败最多重试 3 次。
- 让工具栏模板页与公共资源库工作流共享数据、缩略图和插入逻辑。
- 让文本打散手动运行与组自动运行产生相同、顺序稳定的文本节点。
- 让锁定状态在拖拽开始、过程、结束和 position change 四层都生效。

## 3. 数据契约

### 3.1 CodeNodeData

- `code`: 当前 Python 代码。
- `presets`: `{id,name,code,createdAt,updatedAt}[]`，最多 30 个。
- `activePresetId`: 当前预设。
- `output`: 最近 JSON 输出。
- `status/error`: 运行状态。

输入统一为：

```json
{
  "texts": [],
  "images": [],
  "videos": [],
  "audios": [],
  "upstream": []
}
```

Python 中暴露 `input_data`，用户将结果写入 `result`。返回值必须可 JSON 序列化。

### 3.2 LabelNodeData

- `text`
- `fontSize`: 12 至 96
- `textColor`
- `backgroundColor`
- `locked`

标签无输入输出 handle，锁定时设置 `draggable=false`。

### 3.3 GroupBoxData

新增 `executionCount`，范围 1 至 99，默认 1。全局执行管理器的 `executionCount` 保留，表示整个计划重复轮数；组框的 `executionCount` 表示该组在每一全局轮中执行几次。

## 4. 执行语义

每个节点一次尝试完成后读取 `lastDone.ok`：

1. 成功：继续后继节点。
2. 失败：自动重新触发同一节点。
3. 最多额外重试 3 次，总尝试最多 4 次。
4. 仍失败：终止当前批次并显示节点、轮次和错误信息。
5. 用户取消：立即停止，不继续重试。

文本打散实现独立 `runTextSplitScatter()`：节点按钮和 `useRunTrigger()` 调用同一函数，按当前 segments 顺序创建文本节点，替换本节点上一次自动运行产生的结果。

## 5. Python 沙箱

- API：`POST /api/code-node/execute`。
- 仅登录用户可调用，沿用 CSRF 防护。
- Node API 启动隔离 Python 子进程。
- 参数：`python3 -I -S`、5 秒超时、256 KB stdout/stderr 上限、最小环境变量。
- AST 禁止 import、dunder 属性、文件、网络、进程、动态代码执行和反射名称。
- 安全 builtins 只保留基础类型、集合、排序、聚合和异常。
- 只允许纯计算模块：`json/math/re/statistics/datetime`。

## 6. 模板页

`CanvasToolbar` 只保留模板按钮和 open state。新 `WorkflowTemplateModal`：

- 加载公共资源库 `kind=workflow`。
- 左侧按公共分类展示。
- 顶部搜索、分类筛选和排序。
- 主区使用资源库 `thumbUrl/fileUrl/workflowPreview`。
- 点击卡片调用现有 `onInsertMaterial`/workflow fragment 插入链。
- 提供 loading、empty、error、关闭和键盘 Escape 状态。
- 不显示旧静态模板数量 badge。

## 7. UI 归属

- 代码节点：工具节点，橙色。
- 标签节点：辅助节点，灰蓝色。
- 复用现有节点标题栏、输入框、按钮、色板、圆角和选中态。
- 模板弹层延续当前深色工作台，青色为唯一强调色；不引入新组件库。

## 8. 兼容与迁移

- 缺少新字段的旧画布使用默认值。
- 静态 `CANVAS_TEMPLATES` 暂保留配置文件用于历史兼容，但不再作为工具栏主入口。
- 代码和标签节点进入权限 Subject 注册目录，初始遵循现有发布策略。
- 工作流导出保留代码和预设，但清理运行输出和错误状态。

## 9. 验收标准

- 代码节点可运行、保存/切换/覆盖预设并随画布恢复。
- 标签节点无端口，样式可调，固定后不可拖动。
- 组框循环次数生效；失败节点最多重试 3 次。
- 模板页只读取公共工作流资源，缩略图与资源库一致。
- 文本打散手动/自动输出一致且顺序稳定。
- 锁定组成员 mouseup 后位置不变。
- 相关单测、type-check、Harness 和浏览器截图验证通过。
