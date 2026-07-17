# Storage 与 Data 系统

## 这个系统负责什么

Storage 与 Data 系统负责 PostgreSQL、Redis、文件输出目录、生成库素材访问和数据落库边界。

## 建议阅读顺序

1. `postgres-and-redis-boundaries.md`
2. `material-and-output-storage.md`
3. 根 `CONTEXT.md` 中的 Generation Artifact / Resource Asset 术语
4. `docs/adr/0001-generation-artifact-authority-and-lifecycle.md`（Accepted；部署状态仍以 ops/current 为准）

## 相关系统

- `../api/`
- `../worker/`
- `../canvas/`

## 兼容正文来源

- `docs/project-atlas/data-model-navigation.md`

## 更新规则

- 新的 Storage/Data 正文优先写当前系统目录
- atlas 文件只保留兼容层导航正文
