import {
  Activity, AlertTriangle, Bot, Check, ChevronRight, CirclePause, Database, FileText, Gauge,
  GitBranch, ListChecks, Loader2, Play, Plus, RefreshCw, Route, ShieldCheck, SlidersHorizontal,
  Sparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ModelRecord } from "./admin-types";
import type { AdminAgentRuntimeViewId } from "./admin-view-model";
import { AdminAgentRoleConfigurationEditor } from "./admin-agent-role-configuration-editor";
import { AdminAgentPoolEditor } from "./admin-agent-pool-editor";
import { AdminAgentKnowledgeEditor } from "./admin-agent-knowledge-editor";
import { AdminAgentQualityEditor } from "./admin-agent-quality-editor";
import {
  adminAgentGovernanceApi,
  type AgentApproval,
  type AgentAuditRecord,
  type AgentDefinition,
  type AgentEnvironment,
  type AgentOverview,
  type AgentRuntimeControl,
  type AgentRunsData,
  type AgentVersionStatus,
  type KnowledgeCollection,
  type LlmRoutePool,
  type NodeCapability,
  type QualityProfile,
  type RecoveryDecision,
  type AgentToolData,
  type AgentRoleWorkspaceData,
  type AgentRecoveryWorkspaceData,
} from "./admin-agent-governance-api";

interface Props { activeView: AdminAgentRuntimeViewId; models: ModelRecord[] }
type Data = AgentOverview | AgentRoleWorkspaceData | AgentRecoveryWorkspaceData | LlmRoutePool[] | AgentToolData | NodeCapability[] | KnowledgeCollection[] | QualityProfile[] | AgentRunsData | AgentApproval[] | AgentAuditRecord[];

export function AdminAgentGovernanceWorkspace({ activeView, models }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const next = await ({
        overview: adminAgentGovernanceApi.overview,
        roles: adminAgentGovernanceApi.roleWorkspace,
        "llm-routes": adminAgentGovernanceApi.pools,
        tools: adminAgentGovernanceApi.tools,
        nodes: adminAgentGovernanceApi.nodes,
        knowledge: adminAgentGovernanceApi.knowledge,
        quality: adminAgentGovernanceApi.qualityProfiles,
        recovery: adminAgentGovernanceApi.recoveryWorkspace,
        runs: adminAgentGovernanceApi.runs,
        approvals: adminAgentGovernanceApi.approvals,
        audit: adminAgentGovernanceApi.audit,
      } satisfies Record<AdminAgentRuntimeViewId, () => Promise<Data>>)[activeView]();
      setData(next);
    } catch (nextError) { setError(message(nextError)); }
    finally { setLoading(false); }
  }, [activeView]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(work: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); setNotice("更改已保存"); await load(); }
    catch (nextError) { setError(message(nextError)); }
    finally { setBusy(false); }
  }

  return (
    <section className="agent-governance-workspace">
      <div className="agent-governance-toolbar">
        <div><strong>{viewTitle(activeView)}</strong><span>{viewDescription(activeView)}</span></div>
        <button className="icon-button" type="button" onClick={() => void load()} disabled={loading || busy} title="刷新当前治理视图"><RefreshCw aria-hidden="true" /></button>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="agent-success-banner" role="status">{notice}</div> : null}
      {loading ? <Loading /> : (
        <>
          {activeView === "overview" ? <OverviewView value={data as AgentOverview} busy={busy} mutate={mutate} /> : null}
          {activeView === "roles" ? <RolesView value={data as AgentRoleWorkspaceData} busy={busy} mutate={mutate} /> : null}
          {activeView === "llm-routes" ? <PoolsView value={data as LlmRoutePool[]} models={models.filter((model) => model.capability === "chat" && model.enabled)} busy={busy} mutate={mutate} /> : null}
          {activeView === "tools" ? <ToolsView value={data as AgentToolData} busy={busy} mutate={mutate} /> : null}
          {activeView === "nodes" ? <NodesView value={data as NodeCapability[]} /> : null}
          {activeView === "knowledge" ? <KnowledgeView value={data as KnowledgeCollection[]} busy={busy} mutate={mutate} /> : null}
          {activeView === "quality" ? <QualityView value={data as QualityProfile[]} busy={busy} mutate={mutate} /> : null}
          {activeView === "recovery" ? <RecoveryView value={data as AgentRecoveryWorkspaceData} busy={busy} mutate={mutate} /> : null}
          {activeView === "runs" ? <RunsView value={data as AgentRunsData} /> : null}
          {activeView === "approvals" ? <ApprovalsView value={data as AgentApproval[]} busy={busy} mutate={mutate} /> : null}
          {activeView === "audit" ? <AuditView value={data as AgentAuditRecord[]} /> : null}
        </>
      )}
    </section>
  );
}

function OverviewView({ value, busy, mutate }: { value: AgentOverview; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const metrics = value?.metrics || {};
  return <div className="agent-governance-stack">
    <div className="agent-metric-grid">
      <Metric icon={<Activity />} label="活跃 Agent" value={metrics.activeAgentRuns} />
      <Metric icon={<GitBranch />} label="活跃画布运行" value={metrics.activeCanvasRuns} />
      <Metric icon={<AlertTriangle />} label="异常 LLM 路由" value={metrics.unhealthyRoutes} tone={metrics.unhealthyRoutes ? "warning" : "normal"} />
      <Metric icon={<ListChecks />} label="待审批" value={metrics.pendingApprovals} tone={metrics.pendingApprovals ? "warning" : "normal"} />
      <Metric icon={<Sparkles />} label="24h 质量评估" value={metrics.evaluations24h} />
    </div>
    <ActionHead title="环境总开关" action={<button type="button" className="ghost-action" disabled={busy} onClick={() => void mutate(adminAgentGovernanceApi.bootstrap)}><Plus />初始化默认角色草稿</button>} />
    <p className="agent-section-description">环境开关只改变服务端允许范围，不自动发布任何配置。初始化操作也是幂等的，不会覆盖已有角色或配置。</p>
    <div className="agent-control-table">
      {(value?.controls || []).map((control) => <ControlRow key={control.environment} value={control} busy={busy} mutate={mutate} />)}
    </div>
  </div>;
}

function ControlRow({ value, busy, mutate }: { value: AgentRuntimeControl; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const keys: Array<[keyof AgentRuntimeControl, string]> = [["agentEnabled", "Agent"], ["canvasRunsEnabled", "Canvas Run"], ["qualityEvaluationEnabled", "质量评估"], ["automaticRecoveryEnabled", "自动恢复"]];
  return <div className="agent-control-row">
    <div className="agent-control-environment"><EnvironmentBadge value={draft.environment} /><small>revision {draft.revision}</small></div>
    <div className="agent-control-toggles">{keys.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} /><span>{label}</span></label>)}</div>
    <button type="button" className="primary-action" disabled={busy || sameControl(draft, value)} onClick={() => void mutate(() => adminAgentGovernanceApi.updateControls(draft))}><Check aria-hidden="true" />应用</button>
  </div>;
}

function RolesView({ value, busy, mutate }: { value: AgentRoleWorkspaceData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ agentKey: "", name: "", role: "planner", description: "" });
  return <div className="agent-governance-stack">
    <ActionHead title={`${value.definitions.length} 个 Agent 定义`} action={<button type="button" className="primary-action" onClick={() => setShowCreate(!showCreate)}><Plus />新建角色</button>} />
    {showCreate ? <InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createRole(form))} disabled={busy || !form.agentKey || !form.name} submit="创建角色">
      <Field label="Agent Key"><input value={form.agentKey} onChange={(event) => setForm({ ...form, agentKey: event.target.value })} /></Field>
      <Field label="名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="角色"><RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} /></Field>
      <Field label="说明"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
    </InlineForm> : null}
    <AdminAgentRoleConfigurationEditor value={value} busy={busy} mutate={mutate} />
  </div>;
}

function PoolsView({ value, models, busy, mutate }: { value: LlmRoutePool[]; models: ModelRecord[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ poolKey: "", name: "", role: "planner", scenario: "assistant-chat" });
  return <div className="agent-governance-stack">
    <ActionHead title={`${value.length} 个 LLM 路由池`} action={<button type="button" className="primary-action" onClick={() => setCreating(!creating)}><Plus />新建路由池</button>} />
    <div className="scope-note"><ShieldCheck /><span>这里只接受后台模型目录中已启用的 <code>chat</code> 模型。图片、视频、音频生成模型不进入该路由池。</span></div>
    {creating ? <InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createPool(form))} disabled={busy || !form.poolKey || !form.name} submit="创建路由池">
      <Field label="Pool Key"><input value={form.poolKey} onChange={(event) => setForm({ ...form, poolKey: event.target.value })} /></Field>
      <Field label="名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="角色"><RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} /></Field>
      <Field label="场景"><input value={form.scenario} onChange={(event) => setForm({ ...form, scenario: event.target.value })} /></Field>
    </InlineForm> : null}
    <AdminAgentPoolEditor pools={value} models={models} busy={busy} mutate={mutate} />
  </div>;
}

function ToolsView({ value, busy, mutate }: { value: AgentToolData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <div className="agent-governance-stack"><SectionHead title="固定工具注册表" description="工具必须先存在于代码注册表，再由策略缩小权限；后台不能添加任意 Shell 或 HTTP 工具。" />
    <div className="agent-tool-list">{value.catalog.map((tool) => <ToolPolicyRow key={tool.name} tool={tool} policy={value.policies.find((item) => item.subjectType === "platform" && item.toolName === tool.name)} busy={busy} mutate={mutate} />)}</div>
  </div>;
}

function ToolPolicyRow({ tool, policy, busy, mutate }: { tool: AgentToolData["catalog"][number]; policy?: AgentToolData["policies"][number]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const constraints = policy?.constraints || {};
  const [draft, setDraft] = useState({
    effect: policy?.effect || (tool.approvalRequired ? "require_approval" : "allow"),
    maxCallsPerRun: Number(constraints.maxCallsPerRun || 20),
    requireCanvasRevision: constraints.requireCanvasRevision !== false,
    requireBudget: constraints.requireBudget !== false,
  });
  useEffect(() => setDraft({ effect: policy?.effect || (tool.approvalRequired ? "require_approval" : "allow"), maxCallsPerRun: Number(policy?.constraints.maxCallsPerRun || 20), requireCanvasRevision: policy?.constraints.requireCanvasRevision !== false, requireBudget: policy?.constraints.requireBudget !== false }), [policy?.revision, tool.approvalRequired]);
  return <div className="agent-tool-row"><div><strong>{tool.label}</strong><code>{tool.name}</code><p>{tool.description}</p></div><div className="agent-tool-policy-editor"><StatusBadge value={tool.risk} /><label><span>效果</span><select value={draft.effect} disabled={busy} onChange={(event) => setDraft({ ...draft, effect: event.target.value })}><option value="allow" disabled={tool.approvalRequired}>允许</option><option value="require_approval">需审批</option><option value="deny">拒绝</option></select></label><label><span>每 Run 上限</span><input type="number" min="1" max="1000" value={draft.maxCallsPerRun} onChange={(event) => setDraft({ ...draft, maxCallsPerRun: Number(event.target.value) })} /></label><label><input type="checkbox" checked={draft.requireCanvasRevision} onChange={(event) => setDraft({ ...draft, requireCanvasRevision: event.target.checked })} /><span>校验画布 revision</span></label><label><input type="checkbox" checked={draft.requireBudget} onChange={(event) => setDraft({ ...draft, requireBudget: event.target.checked })} /><span>校验预算</span></label><button type="button" className="primary-action" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.updateToolPolicy({ subjectType: "platform", toolName: tool.name, effect: draft.effect, constraints: { maxCallsPerRun: draft.maxCallsPerRun, requireCanvasRevision: draft.requireCanvasRevision, requireBudget: draft.requireBudget }, revision: policy?.revision }))}><Check />保存</button></div></div>;
}

function NodesView({ value }: { value: NodeCapability[] }) {
  const native = value.filter((item) => item.serverRuntime === "native_server").length;
  const planEligible = value.filter((item) => item.planEligible).length;
  return <div className="agent-governance-stack"><div className="scope-note"><Database /><span>{value.length} 个维护节点，{planEligible} 个可进入 Canvas Run 计划，{native} 个已迁移服务端 runtime。目录同时进入规划、监督、检查和恢复 Agent 的受控上下文。</span></div><DataTable headers={["节点", "用途与运行", "输入 / 输出", "连接与模型", "失败与 Agent"]}>{value.map((item) => <tr key={item.nodeType}><td><strong>{item.label}</strong><code>{item.nodeType}</code></td><td><p>{item.description}</p><small>{item.executionKind} · {item.planEligible ? "可进入计划" : "仅说明"}</small><StatusBadge value={item.serverRuntime} /></td><td><small>入：{portSummary(item.inputs)}</small><small>出：{portSummary(item.outputs)}</small></td><td><small>上游：{item.recommendedUpstream.join("、") || "无"}</small><small>下游：{item.recommendedDownstream.join("、") || "无"}</small><small>规则：{item.connectionRules.join(" ")}</small><small>示例：{item.usageExamples.join(" ")}</small><small>替代：{item.alternativeNodeTypes.join("、") || "无"}</small><small>能力：{item.modelCapabilityHints.join("、") || "无"}</small></td><td><small>{item.commonFailureCodes.join("、") || "无常见失败码"}</small><small>Agent：{item.agentAllowedActions.join("、") || "无"}</small></td></tr>)}</DataTable></div>;
}

function portSummary(ports: NodeCapability["inputs"]) {
  return ports.length ? ports.map((port) => `${port.key}:${port.valueTypes.join("|")}(${port.cardinality}${port.required ? "，必填" : ""})`).join("；") : "无";
}

function KnowledgeView({ value, busy, mutate }: { value: KnowledgeCollection[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <AdminAgentKnowledgeEditor value={value} busy={busy} mutate={mutate} />;
}

function QualityView({ value, busy, mutate }: { value: QualityProfile[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <AdminAgentQualityEditor value={value} busy={busy} mutate={mutate} />;
}

function RunsView({ value }: { value: AgentRunsData }) { return <div className="agent-governance-stack"><SectionHead title="Agent Run" description="最近的有界规划、理解、检查与恢复运行。" /><RunTable rows={value.agentRuns} /><SectionHead title="Canvas Run" description="按画布 revision 和拓扑计划持久化的运行。" /><RunTable rows={value.canvasRuns} /></div>; }
function RecoveryView({ value, busy, mutate }: { value: AgentRecoveryWorkspaceData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const roles = { ...value.roles, definitions: value.roles.definitions.filter((definition) => definition.role === "recovery" || definition.role === "manager") };
  return <div className="agent-governance-stack"><SectionHead title="恢复策略" description="恢复角色的发布配置决定工具、预算、审批与自动恢复次数。" /><AdminAgentRoleConfigurationEditor value={roles} busy={busy} mutate={mutate} /><SectionHead title="恢复决策账本" description="最近的失败分类、目标模型与审批状态。" /><DataTable headers={["时间", "Owner", "失败分类", "恢复决策", "模型变化", "状态"]}>{value.decisions.map((item) => <tr key={item.id}><td>{formatTime(item.createdAt)}</td><td>{item.ownerEmail}</td><td><StatusBadge value={item.failureClass} /></td><td><strong>{item.decision}</strong><small>{item.reason}</small></td><td><code>{item.currentModelId || "-"}</code><small>{item.targetModelId && item.targetModelId !== item.currentModelId ? `→ ${item.targetModelId}` : "同配置"}</small></td><td><StatusBadge value={item.status} /></td></tr>)}</DataTable></div>;
}
function RunTable({ rows }: { rows: AgentRunsData["agentRuns"] }) { return <DataTable headers={["运行", "Owner", "角色 / 场景", "状态", "更新时间"]}>{rows.map((row) => <tr key={row.id}><td><code>{row.id}</code></td><td>{row.ownerEmail}</td><td>{[row.role, row.scenario].filter(Boolean).join(" · ") || row.canvasId}</td><td><StatusBadge value={row.status} /></td><td>{formatTime(row.updatedAt)}</td></tr>)}</DataTable>; }

function ApprovalsView({ value, busy, mutate }: { value: AgentApproval[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) { return value.length ? <div className="agent-approval-list">{value.map((item) => <div className="agent-approval-row" key={item.id}><div><StatusBadge value={item.status} /><strong>{item.actionType}</strong><span>{item.ownerEmail} · {formatTime(item.createdAt)}</span></div><code>{item.canvasRunId}</code>{item.status === "pending" ? <div><button type="button" className="primary-action" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.decideApproval(item.id, "approved", "管理员批准"))}><Check />批准</button><button type="button" className="danger-action" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.decideApproval(item.id, "rejected", "管理员拒绝"))}><X />拒绝</button></div> : <p>{item.decisionReason}</p>}</div>)}</div> : <Empty label="没有待处理或近期审批" />; }
function AuditView({ value }: { value: AgentAuditRecord[] }) { return <DataTable headers={["时间", "Agent Run", "动作", "工具", "状态"]}>{value.map((item) => <tr key={item.id}><td>{formatTime(item.createdAt)}</td><td><code>{item.agentRunId}</code></td><td>{item.actionType}</td><td><code>{item.toolName || "-"}</code></td><td><StatusBadge value={item.status} /></td></tr>)}</DataTable>; }

function VersionRow({ label, status, publications, busy, onTransition, onPublish }: { label: string; status: AgentVersionStatus; publications: Array<{ environment: AgentEnvironment }>; busy: boolean; onTransition: (status: AgentVersionStatus) => void; onPublish: (environment: AgentEnvironment) => void }) { return <div className="agent-version-row"><div><strong>{label}</strong><StatusBadge value={status} />{publications.map((item) => <EnvironmentBadge key={item.environment} value={item.environment} />)}</div><VersionActions status={status} busy={busy} onTransition={onTransition} onPublish={onPublish} /></div>; }
function VersionActions({ status, busy, onTransition, onPublish }: { status: AgentVersionStatus; busy: boolean; onTransition: (status: AgentVersionStatus) => void; onPublish: (environment: AgentEnvironment) => void }) { return <div className="agent-inline-actions">{status === "draft" ? <button type="button" disabled={busy} onClick={() => onTransition("review")}>送审</button> : null}{status === "review" ? <><button type="button" disabled={busy} onClick={() => onTransition("draft")}>退回</button><button type="button" disabled={busy} onClick={() => onTransition("approved")}>批准</button></> : null}{status === "approved" ? <><button type="button" disabled={busy} onClick={() => onPublish("gray")}>发布 Gray</button><button type="button" disabled={busy} onClick={() => onPublish("production")}>发布 Production</button></> : null}</div>; }
function RoleSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)}>{["planner", "manager", "checker", "recovery", "image_understanding", "video_understanding"].map((role) => <option key={role} value={role}>{role}</option>)}</select>; }
function InlineForm({ children, onSubmit, disabled, submit }: { children: ReactNode; onSubmit: () => Promise<void>; disabled: boolean; submit: string }) { return <form className="agent-inline-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>{children}<button type="submit" className="primary-action" disabled={disabled}><Check />{submit}</button></form>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="agent-field"><span>{label}</span>{children}</label>; }
function ActionHead({ title, action }: { title: string; action: ReactNode }) { return <div className="agent-action-head"><strong>{title}</strong>{action}</div>; }
function SectionHead({ title, description }: { title: string; description: string }) { return <div className="agent-section-head"><strong>{title}</strong><span>{description}</span></div>; }
function Metric({ icon, label, value, tone = "normal" }: { icon: ReactNode; label: string; value?: number; tone?: string }) { return <div className={`agent-metric agent-metric--${tone}`}>{icon}<span>{label}</span><strong>{value || 0}</strong></div>; }
function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="data-table-wrap agent-data-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function StatusBadge({ value }: { value: string }) { return <span className={`agent-status agent-status--${value.replace(/_/g, "-")}`}>{statusLabel(value)}</span>; }
function EnvironmentBadge({ value }: { value: AgentEnvironment }) { return <span className={`agent-environment agent-environment--${value}`}>{value === "gray" ? "Gray" : "Production"}</span>; }
function Empty({ label }: { label: string }) { return <div className="agent-empty"><CirclePause /><span>{label}</span></div>; }
function Loading() { return <div className="starlight-page-loading"><Loader2 className="spin" />正在加载智能体治理数据...</div>; }
function viewTitle(view: AdminAgentRuntimeViewId) { return ({ overview: "Agent 运行总览", roles: "Agent 角色与配置", "llm-routes": "LLM 路由池", tools: "工具与权限", nodes: "节点能力目录", knowledge: "Agent 知识库", quality: "媒体质量策略", recovery: "生成失败恢复", runs: "运行记录", approvals: "动作审批", audit: "Agent 动作审计" })[view]; }
function viewDescription(view: AdminAgentRuntimeViewId) { return ({ overview: "环境级控制与实时态势", roles: "定义、草稿、审核与环境发布", "llm-routes": "仅管理 Agent 使用的聊天模型", tools: "固定注册表与最小权限策略", nodes: "服务端执行迁移的代码权威投影", knowledge: "公开与内部内容分域维护", quality: "图片与视频使用独立评分配置", recovery: "有限重试、参数修复、节点备选模型与停止条件", runs: "Canvas Run 与 Agent Run 权威账本", approvals: "用户与管理员确认高风险动作", audit: "不可变动作、工具结果与错误记录" })[view]; }
function statusLabel(value: string) { return ({ enabled: "启用", disabled: "停用", draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役", pending: "待处理", rejected: "已拒绝", cancelled: "已取消", running: "运行中", succeeded: "成功", failed: "失败", queued: "排队", planned: "已计划", paused: "已暂停", awaiting_approval: "等待审批", healthy: "健康", degraded: "降级", circuit_open: "熔断", legacy_browser: "浏览器运行", native_server: "服务端运行", observe: "观察", execute: "执行", modify: "修改", public: "公开", internal: "内部" } as Record<string, string>)[value] || value; }
function formatTime(value: number) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-"; }
function sameControl(left: AgentRuntimeControl, right: AgentRuntimeControl) { return left.agentEnabled === right.agentEnabled && left.canvasRunsEnabled === right.canvasRunsEnabled && left.automaticRecoveryEnabled === right.automaticRecoveryEnabled && left.qualityEvaluationEnabled === right.qualityEvaluationEnabled; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
