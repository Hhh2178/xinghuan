# ADR 0006：双轨发布产物与运行时封装

> **Status:** Accepted
> **Date:** 2026-08-03
> **Owners:** Build / Release / Runtime / Operations
> **Decision Scope:** Production packaging / Deployment / Runtime verification
> **Supersedes:** None

## Context

开发/调试产物继续保留 TypeScript、源码映射、测试和完整工作区，供内部开发与排障使用。部署产物改为 runtime-only sealed archive：API、Worker 和 readiness CLI 使用 esbuild 绑定内部包，Web/Admin 使用构建后的静态资源，归档只复制显式 allowlist，并以 `BUILD-MANIFEST.json` 和相邻 `.tar.gz.sha256` 证明内容与归档身份。

Gray 先验证一个不可变归档，Production 只晋级同一个归档和 sidecar，禁止为 Production 重新构建。远端只执行 `npm ci --omit=dev`、迁移和运行态验证；权限 readiness 使用 `node apps/api/dist/cli/permission-readiness.js`，不依赖源码或 `tsx`。

## Decision

- 该方案隐藏服务端源码、测试、设计文档和 source map，但不能绝对隐藏浏览器端已发送给用户的前端代码。
- 服务器 root、部署用户、运行时环境变量和数据库管理员仍然可以访问其权限范围内的内容；这些不属于归档封装可以消除的边界。
- 密钥、数据库 URL、运行数据、日志和上传文件永不进入归档或 Git。

## Alternatives

保留源码直接部署最简单，但会暴露项目结构并要求生产安装开发工具；完全闭源前端也不可行，因为浏览器必须接收可执行资源。双轨产物在不改变本地开发体验的前提下收紧服务器暴露面，代价是需要维护 bundle、allowlist、manifest、sidecar 和运行态 contract。

## Consequences

开发工作区仍可照常运行，部署归档更小且不携带服务端源码；代价是 bundle、allowlist、manifest、sidecar 和运行态 contract 都必须同步维护。

## Verification

sealed archive 必须通过 `verify:release-package-contract`、版本对齐、manifest/sidecar 校验、Gray dry-run 和 runtime readiness。

## Migration And Rollback

失败时保留失败 Release，不删除数据；通过 current symlink 回指上一份已验证归档即可回滚。实际环境发布仍需遵守 `ops/current/release-state.json` 和对应验收清单。
