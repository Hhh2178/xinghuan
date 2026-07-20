# 媒体输出保留与批次追加 Gray v0.7.13 验证

- 状态：`PASS`
- 实际模型：AIFork `grok-imagine-video-1.5-fast`。
- 生成数量：`2`；第一个视频完成后立即显示，第二个完成后追加到同一输出素材节点，页面显示 `视频 (2)`。
- 刷新验证：刷新后两个视频文件链接均保留，输出节点未清空。
- 视觉验证：Gray 页面 v0.7.13 加载正常，视频节点、上传素材节点、输出素材节点布局正常；截图证据：`output/playwright/gray-v0713-after-refresh.png`。
- 累积开关：默认关闭；手动开启后刷新仍保持勾选。
- 运行态：API/Worker active，公网/内网状态 `0.7.13 / gray / enforced`，权限 readiness `ready=true`，failures `0`。
- 自动化：定向测试、web type-check、release prepare/build/package 全部通过。
