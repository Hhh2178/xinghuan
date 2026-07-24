export const CANVAS_RUN_FAILURE_DIAGNOSTIC_VERSION = "canvas-run-failure-diagnostic/v1" as const;

export type CanvasRunFailureCategory =
  | "workflow"
  | "environment"
  | "input"
  | "capability"
  | "model"
  | "provider"
  | "queue"
  | "budget"
  | "permission"
  | "cancellation"
  | "timeout"
  | "unknown";

export interface CanvasRunFailureDiagnosticInput {
  code?: unknown;
  eventType?: unknown;
  message?: unknown;
  reason?: unknown;
  failureCategory?: unknown;
  providerDiagnostic?: unknown;
  waitReason?: unknown;
  runId?: unknown;
  runStepId?: unknown;
  nodeId?: unknown;
  nodeType?: unknown;
  stepNumber?: unknown;
  providerName?: unknown;
  modelName?: unknown;
  taskId?: unknown;
  requestId?: unknown;
  upstreamHttpStatus?: unknown;
}

export interface CanvasRunFailureDiagnostic {
  version: typeof CANVAS_RUN_FAILURE_DIAGNOSTIC_VERSION;
  category: CanvasRunFailureCategory;
  title: string;
  summary: string;
  observed: string;
  likelyCause: string;
  impact: string;
  action: string;
  retryable: boolean;
  location: {
    runId?: string;
    runStepId?: string;
    nodeId?: string;
    nodeType?: string;
    stepNumber?: number;
    providerName?: string;
    modelName?: string;
  };
  technical: {
    code: string;
    taskId?: string;
    requestId?: string;
    upstreamHttpStatus?: number;
  };
}

export function projectCanvasRunFailureDiagnostic(input: CanvasRunFailureDiagnosticInput): CanvasRunFailureDiagnostic {
  const code = safeDiagnostic(input.code, "CANVAS_RUN_UNKNOWN_ERROR", 240);
  const eventType = safeDiagnostic(input.eventType, "", 160);
  const failureCategory = safeDiagnostic(input.failureCategory, "", 120);
  const waitReason = safeDiagnostic(input.waitReason, "", 160);
  const evidence = safeDiagnostic(input.providerDiagnostic || input.message || input.reason, "", 500);
  const statusCode = optionalInteger(input.upstreamHttpStatus);
  const normalized = `${code} ${eventType} ${failureCategory} ${waitReason} ${evidence}`.toLowerCase();
  const definition = classify(normalized, statusCode);
  return {
    version: CANVAS_RUN_FAILURE_DIAGNOSTIC_VERSION,
    category: definition.category,
    title: definition.title,
    summary: definition.summary,
    observed: evidence || definition.summary,
    likelyCause: definition.likelyCause,
    impact: definition.impact,
    action: definition.action,
    retryable: definition.retryable,
    location: compactObject({
      runId: safeIdentifier(input.runId),
      runStepId: safeIdentifier(input.runStepId),
      nodeId: safeIdentifier(input.nodeId),
      nodeType: safeDiagnostic(input.nodeType, "", 120) || undefined,
      stepNumber: optionalPositiveInteger(input.stepNumber),
      providerName: safeDiagnostic(input.providerName, "", 160) || undefined,
      modelName: safeDiagnostic(input.modelName, "", 200) || undefined,
    }),
    technical: compactObject({
      code,
      taskId: safeIdentifier(input.taskId),
      requestId: safeIdentifier(input.requestId),
      upstreamHttpStatus: statusCode,
    }),
  };
}

function classify(text: string, statusCode?: number): Omit<CanvasRunFailureDiagnostic, "version" | "observed" | "location" | "technical"> {
  if (/cancelled|canceled|local_cancel/.test(text)) return definition("cancellation", "本次托管已取消", "运行已收到取消指令。", "用户主动取消，或上游任务在本地关闭。", "未执行的下游节点不会继续运行，已经完成的产物仍然保留。", "需要继续时，请基于当前工作流新建运行计划。", false);
  if (/canvas_run_disabled|canvas_run_postgres_required|agent_runtime_capability_disabled/.test(text)) return definition("environment", "AI 托管运行环境不可用", "当前环境没有准备好托管运行所需服务。", "Canvas Run 开关、PostgreSQL、Worker 或 Agent Runtime 尚未就绪。", "运行计划不会创建或继续执行。", "请管理员检查当前环境的托管开关、数据库和 Worker 状态。", false);
  if (/permission|forbidden|not allowed|access denied|agent_tool_owner|auth_required/.test(text)) return definition("permission", "当前账号没有执行权限", "服务端拒绝了本次托管操作。", "账号、用户组或资源所有权不允许执行目标节点。", "当前节点未执行，下游节点不会被释放。", "请检查账号权限、素材归属和模型授权后新建运行计划。", false);
  if (/worker.*timeout|poll.*timeout|execution.*timeout|timed?\s*out|超时/.test(text)) return definition("timeout", "执行节点等待超时", "任务在允许时间内没有到达终态。", "Worker、上游轮询或网络响应超过了当前时限。", "当前节点未完成，下游节点继续等待。", "先刷新任务状态；确认上游未继续执行后，再按原计划重试。", true);
  if (/cycle|circular|dependency_loop/.test(text)) return definition("workflow", "工作流存在循环依赖", "节点之间形成了无法确定起点的闭环。", "至少一组节点互相依赖，编译器无法生成合法顺序。", "托管计划不会启动。", "断开闭环中的一条依赖连线，再重新生成运行计划。", false);
  if (/plan_empty/.test(text)) return definition("workflow", "运行计划为空", "当前工作流区域没有可执行节点。", "区域为空、全部节点被跳过，或没有 native-server 节点。", "没有任何节点会被托管执行。", "把支持托管的节点加入区域，并检查跳过设置。", false);
  if (/legacy_node_unsupported|step_unsupported|unsupported|capability/.test(text)) return definition("capability", "节点不支持 AI 托管", "运行计划包含当前服务端无法执行的节点。", "节点仍依赖旧浏览器运行方式，或所需能力未接入 Worker。", "该节点和依赖它的下游节点不会执行。", "替换为支持 native-server 的节点，再重新生成运行计划。", false);
  if (/budget_exceeded|budget|cost_limit|task_limit/.test(text)) return definition("budget", "本次托管达到预算上限", "任务数、成本、Token 或运行时长达到本次 Run 的限制。", "冻结的预算快照不允许继续派发更多任务。", "当前节点停止，已完成节点和产物保持可用。", "调整下一次 Run 的预算或缩小工作流范围后重新创建。", false);
  if (/queue_stalled|waiting_.*window|all_keys_busy|queue.*wait|stalled/.test(text)) return definition("queue", "任务在队列中停留过久", "任务尚未获得可用的本地或渠道执行窗口。", "用户并发、渠道 Key 并发或 Worker 消费能力暂时不足。", "当前节点尚未执行，下游节点继续等待。", "刷新队列状态；窗口恢复后可继续等待，长时间不恢复再联系管理员。", true);
  if (/model_record_repair_required/.test(text)) return definition("model", "模型配置需要修复", "运行快照引用的模型记录不完整。", "旧 Run 缺少稳定模型记录，或模型配置已失效。", "目标节点无法安全派发，下游节点不会执行。", "在后台修复并发布模型后，从最新工作流新建 Run。", false);
  if (/model_unavailable|model_config|model.+not found|model.+disabled/.test(text)) return definition("model", "模型当前不可用", "节点绑定的模型不存在、已停用或与能力不匹配。", "冻结模型记录在当前环境不能执行该节点。", "当前节点未执行，下游节点不会被释放。", "选择已发布且能力匹配的模型，再新建运行计划。", false);
  if (statusCode === 429 || /rate.?limit|too many requests|quota_window/.test(text)) return definition("provider", "渠道当前请求过多", "上游渠道拒绝了本次请求，因为短时间请求量过高。", "渠道限流或账号并发窗口已满。", "当前节点未完成，下游节点继续等待或停止。", "等待渠道窗口恢复后按原计划重试。", true);
  if (/auth|unauthorized|invalid key|api key/.test(text)) return definition("provider", "渠道鉴权失败", "上游渠道没有接受当前凭据。", "Provider Key 无效、类型不匹配或没有模型权限。", "当前节点未创建上游任务，下游节点不会执行。", "请管理员检查对应 Provider 的 Key 类型和模型权限后重试。", false);
  if (/provider|upstream|business_failed|rejected|http_[45]\d\d/.test(text) || (statusCode !== undefined && statusCode >= 400)) return definition("provider", "渠道拒绝了本次请求", "上游服务商返回失败，没有生成可用结果。", "输入、渠道状态或上游业务规则拒绝了请求。", "当前节点未完成，下游节点不会被释放。", "查看节点参数和渠道状态；可重试错误恢复后再按原计划重试。", true);
  if (/workflow_boundary_value_missing/.test(text)) return definition("input", "工作流输入缺少值", "工作流输入变量在运行快照中为空。", "输入节点没有为必填变量提供值。", "依赖该变量的节点不会执行。", "在工作流输入节点填写值，再重新生成运行计划。", false);
  if (/workflow_boundary_variable_type_mismatch/.test(text)) return definition("input", "工作流输入类型不匹配", "输入节点的数据类型与变量定义不同。", "工作流边界无法把当前值传给下游节点。", "依赖该变量的节点不会执行。", "统一输入节点和变量的数据类型，再重新生成运行计划。", false);
  if (/smart_candidate_count_insufficient|candidate.*insufficient/.test(text)) return definition("input", "智能选择器候选不足", "智能选择器没有收到足够的同类型候选。", "上游有效候选少于选择器执行所需数量。", "选择器和它的下游节点不会执行。", "至少连接 2 个同类型候选，再重新生成运行计划。", false);
  if (/input|parameter|invalid|empty|required|candidate_count_insufficient/.test(text)) return definition("input", "节点输入或参数无效", "服务端无法使用当前输入创建任务。", "必填输入缺失、参数不在模型允许范围，或候选数量不足。", "当前节点未执行，下游节点不会被释放。", "修正被标记节点的输入和参数，再新建运行计划。", false);
  return definition("unknown", "运行失败，尚未识别具体类型", "服务端返回了未归类的托管错误。", "现有证据不足以确定唯一原因。", "运行已停止；已经完成的结果保持可用。", "展开技术详情并让 AI 助手结合运行证据分析；不要盲目重复提交。", false);
}

function definition(
  category: CanvasRunFailureCategory,
  title: string,
  summary: string,
  likelyCause: string,
  impact: string,
  action: string,
  retryable: boolean,
) {
  return { category, title, summary, likelyCause, impact, action, retryable };
}

function safeDiagnostic(value: unknown, fallback: string, maximum: number) {
  const raw = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return (raw || fallback)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [已隐藏]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[已隐藏链接]")
    .replace(/(?:api[_-]?key|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "[已隐藏敏感字段]")
    .slice(0, maximum);
}

function safeIdentifier(value: unknown) {
  const text = safeDiagnostic(value, "", 160);
  return text && /^[A-Za-z0-9._:-]+$/.test(text) ? text : undefined;
}

function optionalInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 599 ? number : undefined;
}

function optionalPositiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 100_000 ? number : undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
