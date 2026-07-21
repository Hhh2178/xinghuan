# 上传节点缩放尺寸 Gray v0.7.14 验证

## 已通过

- Release current：`/opt/apps/xinghuan-canvas-next/releases/20260721-upload-node-zoom-sizing-gray-r1-v0714`
- App service：`active`
- Worker service：`active`
- 公网/内网状态：`0.7.14 / gray / enforced`
- 权限 readiness：128 subjects、932 rules、5 principals、0 failures
- 本地：类型检查、Web production build、54 个测试文件 / 199 项测试
- 定向：`mediaNodeSize.test.ts` 6 项通过，包含 12.2% 缩放尺寸复现

## 待完成

- 在已登录 Gray 画布中复测上传图像和上传视频节点：低缩放率刷新前后无底部空白、无内容或端口溢出。

## 环境边界

- Production 仍为 `v0.7.13 / 20260720-media-node-runtime-resume-prod-r1-v0713`。
- 本轮未执行 Production 部署。
