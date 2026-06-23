# Providers 系统

## 这个系统负责什么

Providers 系统负责外部模型平台的协议接入、模型目录、请求体构建、文件字段注入和上游结果解析。

## 关键代码入口

- `apps/api/src/external-proxy.ts`
- `apps/api/src/provider-request-body.ts`
- `apps/worker/src/worker-provider-request-body.ts`
- `apps/worker/src/worker.ts`

## 建议阅读顺序

1. `protocol-layering.md`
2. `request-body-and-file-strategy.md`

## 相关系统

- `../api/`
- `../worker/`

## 兼容正文来源

- `docs/project-atlas/provider-protocol-and-request-body-design.md`

## 更新规则

- 新的 Provider 正文优先写当前系统目录
- atlas 文件只保留兼容层设计正文
