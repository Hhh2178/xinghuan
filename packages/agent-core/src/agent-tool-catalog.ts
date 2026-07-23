export type AgentToolRisk = "observe" | "execute" | "modify";

export interface AgentToolCatalogEntry {
  name: string;
  label: string;
  risk: AgentToolRisk;
  approvalRequired: boolean;
  roles: string[];
  description: string;
}

export const AGENT_TOOL_CATALOG: readonly AgentToolCatalogEntry[] = [
  { name: "canvas.read", label: "读取画布", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager"], description: "读取 owner-scoped 画布 revision、节点和连线摘要。" },
  { name: "canvas-run.preview", label: "预览运行计划", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager"], description: "编译并检查分组顺序、拓扑和输入绑定。" },
  { name: "canvas-run.start", label: "启动托管运行", risk: "execute", approvalRequired: false, roles: ["planner", "manager"], description: "启动已经确认的不可变 Canvas Run Plan。" },
  { name: "canvas-run.pause", label: "暂停运行", risk: "execute", approvalRequired: false, roles: ["manager", "recovery"], description: "在步骤边界暂停服务端托管运行。" },
  { name: "canvas-run.cancel", label: "取消运行", risk: "execute", approvalRequired: false, roles: ["manager", "recovery"], description: "终止运行并阻止释放新步骤。" },
  { name: "canvas-run.retry", label: "重试步骤", risk: "execute", approvalRequired: false, roles: ["recovery", "manager"], description: "按已发布恢复策略执行有限重试。" },
  { name: "artifact.evaluate", label: "评估产物", risk: "observe", approvalRequired: false, roles: ["image_understanding", "video_understanding", "checker"], description: "使用版本化质量配置评估 owner-scoped 图片或视频。" },
  { name: "artifact.select", label: "选择下游输入", risk: "execute", approvalRequired: false, roles: ["checker", "manager"], description: "从已评估批次选择 best、top-k 或阈值候选。" },
  { name: "generation.recover", label: "生成恢复", risk: "execute", approvalRequired: false, roles: ["recovery", "manager"], description: "执行同配置重试或 Run Plan 内已有备选生成模型。" },
  { name: "knowledge.node.get", label: "查询节点事实", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager", "recovery"], description: "从当前 Run 的 Knowledge Snapshot 精确查询节点能力事实。" },
  { name: "knowledge.model.get", label: "查询模型事实", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager", "recovery"], description: "从安全模型投影精确查询模型，不暴露 Provider 密钥或高级配置。" },
  { name: "knowledge.model.search", label: "筛选模型", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager", "recovery"], description: "按兼容节点、LLM 资格、启用状态筛选当前快照中的模型。" },
  { name: "knowledge.documents.search", label: "检索发布知识", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager", "recovery"], description: "在固定 collection allowlist、topK 和 token budget 内检索带引用的发布文档。" },
  { name: "canvas.workflow.inspect", label: "检查工作流", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager"], description: "读取 owner-scoped Canvas revision 的节点与连线。" },
  { name: "canvas.workflow.search", label: "搜索工作流", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager"], description: "在指定 Canvas revision 内搜索节点和相关连线。" },
  { name: "canvas.workflow.validate", label: "验证工作流", risk: "observe", approvalRequired: false, roles: ["planner", "checker", "manager"], description: "验证节点类型、标识和连线引用完整性。" },
  { name: "canvas.patch.propose", label: "提议修改画布", risk: "modify", approvalRequired: true, roles: ["planner", "manager"], description: "创建结构修改 proposal；不会静默修改当前画布。" },
] as const;
