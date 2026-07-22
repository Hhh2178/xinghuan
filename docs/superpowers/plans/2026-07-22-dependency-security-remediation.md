# 依赖安全修复执行计划

## 目标

在不使用 `npm audit fix --force`、不直接修改 Production 的前提下，消除 sharp、esbuild 与 brace-expansion 审计项，并验证图片处理和前端构建兼容性。

## 范围

- 生产运行依赖：`sharp 0.34.5 -> 0.35.3`。
- 构建工具：`Vite 7 -> 8.1.5`、`esbuild -> 0.28.1`。
- 开发检查传递依赖：`brace-expansion 1.1.15 -> 1.1.16`。
- 产品版本：按 Gray PATCH 规则形成候选 `v0.7.19`。

## 执行状态

1. [x] 核对漏洞来源、依赖树和 Node 运行要求。
2. [x] 升级依赖并重新生成 lockfile，未使用 force。
3. [x] 将 Web `manualChunks` 迁移为 Vite 8 兼容的函数式分包。
4. [x] 将图片处理专项从 5 项扩展到 14 项。
5. [x] 执行全新 `npm ci` 和 `npm audit`，漏洞数为 0。
6. [x] 执行全量测试、类型检查、全部 workspace 构建与 CI。
7. [x] 增加离线依赖安全基线门禁，阻止受影响版本重新进入 lockfile。
8. [ ] 准备并部署 Gray v0.7.19 release。
9. [ ] 在 Linux Gray 验证 sharp 原生二进制、图片操作 API、参考图预处理和服务日志。
10. [ ] Gray 验收后再决定是否晋级 Production。

## 测试矩阵

- 正常行为：resize、crop、upscale、水平/垂直 combine、PNG/JPEG 转换。
- 边界行为：裁剪超界收敛、放大倍数上限、2–20 张拼接限制、最多16张参考图。
- 输入安全：目录逃逸、截断图片、非图片字节、单图大小和总请求大小限制。
- 图像语义：透明通道保持或 JPEG flatten、不放大小图、输出尺寸和格式确认。
- 工具链：Web/Admin Vite 8 production build、既有 vendor 分包、release clean install。

## 放行条件

- `npm audit` 为 0。
- 图片专项、全量测试、全部 workspace type-check/build 与项目 CI 全部通过。
- Gray Linux `npm ci`、API/Worker 启动、图片操作 smoke、权限 readiness 和 error journal 通过。
- Production 未经 Gray 验收不得晋级。
