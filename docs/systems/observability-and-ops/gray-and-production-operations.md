# Gray 与 Production 运维

## 当前环境

- gray：`canvas-next.zezhen.online`
- production：`canvas.zezhen.online`

当前发布目标为泽臻新服务器；旧服务器与旧域名仅作为显式回滚来源，不是发布脚本默认目标。

## 当前要求

- 当前运行态判断先看 `ops/README.md`
- 发布后要做 gate 与页面级复查
- gray / production 的版本口径不能长期分叉
