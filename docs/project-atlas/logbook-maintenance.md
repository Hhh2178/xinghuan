# 台账与日志维护规范

## 三层台账

### 1. `DEVLOG.md`

用途：

- 记录逐日真实推进
- 记录本地验证、灰度推进、排障、回滚、修复过程

不负责：

- 作为唯一状态入口
- 承担长期规范和长期架构说明

### 2. `ops/*.md`

用途：

- 记录 gray / production / rollback / hotfix / 验收
- 每一次真实运行态动作独立成文

不负责：

- 承担产品版本总结
- 承担长期结构说明

### 3. `docs/prd/v0.1.0/changelog.md`

用途：

- 记录版本能力变化
- 面向版本回顾和产品层总结

不负责：

- 记录服务器命令
- 记录运维细节

## `DEVLOG.md` 固定模板

```md
## YYYY-MM-DD

### 事项标题

目标:
- 

变更:
- 

验证:
- 

影响:
- 

风险:
- 

下一步:
- 
```

## 最低更新矩阵

### 代码实现完成后

- `DEVLOG.md`
- `docs/prd/v0.1.0/progress.md` 或 `changelog.md`

### 灰度发布后

- `DEVLOG.md`
- 对应 `ops/*gray*.md`
- `ops/README.md`
- 如 active release 变化，再更新：
  - `README.md`
  - `MEMORY.md`
  - `docs/prd/README.md`

### 正式发布后

- `DEVLOG.md`
- 对应 `ops/*prod*.md` 或 `ops/*release*.md`
- `ops/README.md`
- 如 active release 变化，再更新：
  - `README.md`
  - `MEMORY.md`
  - `docs/prd/README.md`

## 防失控规则

- `DEVLOG.md` 不写真实密钥
- 已成为长期规则的内容，不只留在 `DEVLOG.md`
- 已被覆盖的旧发布记录，不继续平铺在 `ops/README.md`
- 任何会写业务对象的验收脚本，都必须：
  - 不写真实脏数据
  - 或者自清理

## 周期性收口检查

建议至少每周做一次：

1. 当前 active release 是否已同步到主入口
2. `ops/README.md` 是否仍挂着明显过期记录
3. `DEVLOG.md` 是否混入长期规范
4. 是否存在新增脚本会留下测试 Provider / 测试用户 / 测试任务
