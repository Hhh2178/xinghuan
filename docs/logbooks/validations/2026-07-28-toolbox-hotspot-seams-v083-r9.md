# Toolbox Hotspot Seams 验证（0.8.3-r9）

## 稳定性行为

- ToolboxParam 的参数控件、素材绑定和多角度预览从主节点壳中分离；既有 patch key、归一化、素材优先级、拖拽更新和运行动作保持不变。
- 上游绑定只接受 owner-visible image fields 或 first/last frame，拒绝非 image upload URL，避免预览误消费视频文件。

## 证据

- ToolboxParam schema、参数区、material binding、preview focused tests 全部通过；Web type-check 通过。
- r9 release prepare 的热点预算、watchlist、工程治理、版本、构建、包契约门禁通过。
- 旧服务器 Gray 严格验证通过：r9、API/Worker active、内部/公网状态均为 0.8.3/gray。
- 旧服务器 Production 严格验证通过：r9、API/Worker active、内部/公网状态均为 0.8.3/production。
- Gray 与 Production 使用同一源码提交 `9005a6cc006856fe0040313cd354ac03f3aa1352` 和同一归档 SHA-256 `758D7E0D5455788D9B9BD18B9D9C64B24F7FFABD91B2984DD5C3076FCAF9ACD6`。
- 未执行 retention apply、历史发布删除或付费 Provider/Agent canary。
