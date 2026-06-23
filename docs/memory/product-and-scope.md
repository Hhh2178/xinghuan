# 产品范围与项目边界

## 项目定位

无限画布 2.0 是公司内部节点式 AIGC 创作平台，目标是让成员通过节点工作流、素材空间和后台治理能力完成图片、视频、音频与文本生成。

## 核心边界

- 旧 `node-banana-enterprise` 不再作为继续开发主干
- 后台是独立管理端，不挂在画布抽屉里
- 生成能力通过外部 API 接入，不在本地 VPS 跑 GPU 推理
- 节点体系以通用节点 + 模型目录 + schema 驱动，而不是“一服务商一节点”

## 当前范围内的核心系统

- Canvas
- Admin
- API
- Worker
- RunningHub
- Provider / 模型体系
- Auth / 会话 / 多用户治理
- Storage / 输出物料化
- Observability / release gate

## 相关入口

- 系统地图：`../systems/README.md`
- 产品文档：`../prd/README.md`
