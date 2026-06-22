# 协作方式与工作流

## 默认协作路径

1. 先读 `AGENTS.md`
2. 再读 `docs/INDEX.md`
3. 根据问题进入 `docs/systems/<system>/`
4. 需要长期背景时读 `MEMORY.md` 或 `docs/memory/README.md`
5. 需要发布、验收或排障证据时读 `ops/README.md` 与 `docs/logbooks/`

## 开工前先判断文档类别

新增或修改文档前，先判断它属于哪一类：

- 治理规则
- 系统知识
- 长期记忆
- 逐日台账
- 发布/验证证据
- 设计与演进记录

如果没有先分类，不要直接新建文件。

## 工作收口要求

### 做系统改动时

至少检查：

- 对应 `docs/systems/<system>/`
- 对应 `docs/records/` 或已有 spec/plan
- 如有长期影响，再更新 `MEMORY.md` 或 `docs/memory/`

### 做发布或验收时

至少检查：

- `README.md`
- `MEMORY.md`
- `ops/README.md`
- `docs/logbooks/releases/`

### 做日常推进时

至少记录到：

- `docs/logbooks/daily/YYYY/YYYY-MM/YYYY-MM-DD.md`

## 入口文件职责

- `AGENTS.md`：总纲、规则、阅读顺序、协作方式
- `README.md`：当前状态摘要
- `MEMORY.md`：长期记忆兼容入口
- `DEVLOG.md`：旧开发台账兼容入口
- `ops/README.md`：运行态与放行入口
