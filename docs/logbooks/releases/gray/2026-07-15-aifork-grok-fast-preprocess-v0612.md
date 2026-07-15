# v0.6.12 AIFork Grok FAST 参考图预处理灰度发布

## 发布信息

- 版本：`v0.6.12`
- 环境：仅 gray
- release：`20260715-aifork-grok-fast-preprocess-v0612`
- 发布包：`dist-release/20260715-aifork-grok-fast-preprocess-v0612.tar.gz`
- 回滚：`20260715-aifork-grok-fast-contract-v0611`
- Production 保持：`v0.5.22`

## 根因

- `v0.6.11` 已发送正确 FAST 字段，但仍把原始 PNG 直接编码为 Data URL。
- 官方插件会先将图片最长边限制为 1024，统一转为 JPEG quality 85 并优化，再写入 `reference_images`。
- 当前三张原图约 1.8-2.1 MB；两图任务可成功，第三张稳定在上游素材上传阶段 403，符合累计载荷阈值特征。

## 变更

- 为 Data URL 参考图增加模型级可选 `referenceImageProcessing`。
- 支持 `format=jpeg`、`maxDimension`、`quality`，公网签名 URL 与已有 Data URL 都走相同处理。
- 使用动态加载 `sharp`；未配置预处理的模型保持原始字节链路，不改变其他 Provider。
- FAST 目标配置固定为 `jpeg / 1024 / 85`，与插件实现一致。

## 验证

- `941x1672 PNG` 处理为 `576x1024 JPEG`，本地 URL 与 Data URL 两条输入路径均通过。
- 22 个测试文件、71 项测试通过；类型检查与发布 gate 通过。
- 真实三图结果见对应 validation。
