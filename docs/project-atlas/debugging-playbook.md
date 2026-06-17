# 排障手册

## 先做分类

先判断问题属于哪一类：

1. 文档 / 状态入口不一致
2. 登录 / 会话 / CSRF
3. 画布保存 / revision conflict
4. 资源 / 生成库访问
5. Provider / 上游生成失败
6. Worker / 队列 / 任务状态机
7. 发布 / gray / production 运行态
8. 验收脚本本身产生假失败

## 第一轮必看入口

1. `README.md`
2. `docs/project-atlas/README.md`
3. `MEMORY.md`
4. `ops/README.md`
5. `DEVLOG.md` 顶部最近记录

## 常用定位命令

### 本地

- `git status --short`
- `codegraph status`
- `npm run build:single-port`
- `npm run verify:local-acceptance-chain`

### 服务器

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
- `systemctl status xinghuan-canvas-next`
- `systemctl status xinghuan-canvas-next-worker`
- `curl http://127.0.0.1:18200/api/status`

## 近期真实根因样本

### 1. 验收脚本假失败

根因：

- 旧脚本没有补 same-origin `Origin`
- file-mode 下多脚本并行踩会话与审计样本

处理：

- 写请求统一补 `Origin / Referer`
- 涉及登录态和审计的脚本串行执行
- 必要时起隔离数据目录实例

### 2. 后台出现假 Provider

根因：

- 观测验收脚本创建测试 Provider 后不自清理

处理：

- 脚本增加 `finally` 回收
- 当前 release 热补丁和仓库脚本都要同步

### 3. 上游报“生成完成但无图片”

根因：

- 上游真实失败，但代理层把异常糊成占位文案或 HTML/非 JSON 通用错误

处理：

- 优先看 API / Worker 的真实上游响应
- 在代理层明确区分：
  - HTML
  - 非 JSON
  - 任务提交失败
  - 轮询失败
  - 最终结果失败

### 4. gray 发布后迁移失败

根因：

- 在 release 目录执行 `npm run db:migrate` 前没加载共享环境文件

处理：

- 先 `source shared/*.env`
- 再执行迁移和 gate

## 判断“是代码问题还是脚本问题”

满足以下任一情况，优先怀疑脚本或环境，而不是直接怀疑业务代码：

- 同一链路在隔离实例通过、在 file-mode 并行失败
- 失败只出现在验收脚本，不出现在真实页面
- 更换同源头后立刻恢复
- 清理测试数据后问题消失

## 排障收尾

问题定位结束后，至少同步一处：

- 长期有效规则 -> `docs/project-atlas/*` 或 `docs/documentation-governance.md`
- 某次发布 / 回滚 / 热补丁 -> `ops/*.md`
- 逐日过程 -> `DEVLOG.md`
