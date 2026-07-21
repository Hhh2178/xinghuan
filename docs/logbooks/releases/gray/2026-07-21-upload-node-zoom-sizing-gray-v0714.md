# 上传节点缩放尺寸修复 Gray v0.7.14 发布

- release：`20260721-upload-node-zoom-sizing-gray-r1-v0714`
- source commit：`2690e09`
- fix commit：`8cb8fc4`
- archive：`20260721-upload-node-zoom-sizing-gray-r1-v0714.tar.gz`
- 回滚：`20260720-media-node-runtime-resume-gray-r2-v0713`

## 变更

- 修复上传图像和上传视频节点在低画布缩放率刷新后出现底部大块空白，或文件信息、操作区、输出端口溢出节点外框的问题。
- 节点 chrome 测量统一使用未受 React Flow transform 影响的 layout CSS pixels，禁止混用 viewport rect 与 `scrollHeight`。
- 显式保存的 `size.mode` 按真实 `auto/manual` 恢复；历史错误高度会在素材 metadata 加载后重新校正。

## 验证

- 本地类型检查、Web production build、`54 files / 199 tests` 通过。
- 12.2% 画布缩放回归场景定向测试通过。
- Gray API/Worker active，公网/内网均返回 `0.7.14 / gray / enforced`。
- 权限 readiness：`ready=true`、`failures=0`。
- 浏览器视觉刷新验收等待已登录的 Gray 会话完成。

本轮只部署 Gray；Production 保持 `v0.7.13`，未执行 Production 部署。
