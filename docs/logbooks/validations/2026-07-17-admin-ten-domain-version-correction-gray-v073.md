# Admin 十域版本口径修正 Gray v0.7.3 验证

## 结论

- `release:gray:verify` 通过，公网与内网 `/api/status` 均返回 `version=0.7.3`、`environment=gray`、`permissionMode=enforced`。
- `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 active。
- 权限 readiness 为 ready，0 failures。
- Release 保留先干跑后执行，删除第 4 个旧目录后剩余数量为 3；`current` 指向本次 release。
- 同一发布包 SHA-256 为 `40a55669c5fafc4927026fbd5978fd569384f74531c7a076399f7fff0ec25242`。

## 治理验证

- 完整 CI 通过：45 个测试文件、163 项测试、全 workspace type-check 与构建。
- 发布治理合同通过；保留脚本干跑不删除，执行模式要求 `--confirm-retention=3`。
