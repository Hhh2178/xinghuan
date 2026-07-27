import {
  Activity, AlertTriangle, Check, CirclePause, GitBranch, History, ListChecks, Loader2,
  Plus, RefreshCw, ShieldCheck, Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { ModelRecord } from "./admin-types";
import type { AdminAgentRuntimeViewId } from "./admin-view-model";
import { AdminAgentRoleConfigurationEditor } from "./admin-agent-role-configuration-editor";
import { AdminAgentPoolEditor } from "./admin-agent-pool-editor";
import { AdminAgentQualityEditor } from "./admin-agent-quality-editor";
import { AdminAgentActivityWorkspace } from "./admin-agent-activity-workspace";
import { canvasAgentPurpose, purposeRouteTemplates } from "./admin-agent-governance-purpose";
import {
  applySupervisionPreset,
  deriveSupervisionMode,
  type SupervisionPreset,
} from "./admin-supervision-mode";
import {
  AdminSupervisionWorkspaceNav,
  createSupervisionWorkspaceState,
  discardSupervisionWorkspaceDraft,
  requestSupervisionWorkspace,
  stayInSupervisionWorkspace,
  supervisionWorkspaceItems,
  updateSupervisionWorkspaceDirty,
  type SupervisionWorkspaceKey,
  type SupervisionWorkspaceState,
} from "./admin-supervision-workspace-nav";
import {
  adminAgentGovernanceApi,
  type AgentApproval,
  type AgentAuditRecord,
  type AgentEnvironment,
  type AgentOverview,
  type AgentRuntimeControl,
  type AgentRunsData,
  type LlmRoutePool,
  type QualityProfile,
  type AgentRoleWorkspaceData,
  type AgentRecoveryWorkspaceData,
  type RecoveryDecision,
} from "./admin-agent-governance-api";

interface Props { activeView: AdminAgentRuntimeViewId; models: ModelRecord[] }
type ModelsData = { roles: AgentRoleWorkspaceData; pools: LlmRoutePool[] };
type PoliciesData = { quality: QualityProfile[]; recovery: AgentRecoveryWorkspaceData };
type ActivityData = { runs: AgentRunsData; approvals: AgentApproval[]; recovery: RecoveryDecision[]; audit: AgentAuditRecord[] };
type SupervisionData = { overview: AgentOverview; models: ModelsData; policies: PoliciesData };
type Data = SupervisionData | ActivityData;

export function canRenderGovernanceData(loading: boolean, data: unknown): boolean {
  return !loading && data !== null;
}

export function AdminAgentGovernanceWorkspace({ activeView, models }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [supervisionNavigation, setSupervisionNavigation] = useState<SupervisionWorkspaceState>(() =>
    createSupervisionWorkspaceState(typeof window === "undefined" ? undefined : window.location.href),
  );

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const next = await ({
        assistants: async () => { throw new Error("ASSISTANT_GOVERNANCE_WORKSPACE_REQUIRED"); },
        supervision: async () => {
          const [overview, roles, pools, quality, recovery] = await Promise.all([
            adminAgentGovernanceApi.overview(),
            adminAgentGovernanceApi.roleWorkspace(),
            adminAgentGovernanceApi.pools(),
            adminAgentGovernanceApi.qualityProfiles(),
            adminAgentGovernanceApi.recoveryWorkspace(),
          ]);
          return { overview, models: { roles, pools }, policies: { quality, recovery } };
        },
        activity: async () => {
          const [runs, approvals, recovery, audit] = await Promise.all([adminAgentGovernanceApi.runs(), adminAgentGovernanceApi.approvals(), adminAgentGovernanceApi.recovery(), adminAgentGovernanceApi.audit()]);
          return { runs, approvals, recovery, audit };
        },
      } satisfies Record<AdminAgentRuntimeViewId, () => Promise<Data>>)[activeView]();
      setData(next);
    } catch (nextError) { setError(message(nextError)); }
    finally { setLoading(false); }
  }, [activeView]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (activeView !== "supervision" || typeof window === "undefined") return;
    const nextPath = `/admin/automation/supervision/${supervisionNavigation.active}`;
    if (window.location.pathname !== nextPath) window.history.replaceState({}, "", nextPath);
  }, [activeView, supervisionNavigation.active]);

  const selectSupervisionWorkspace = useCallback((target: SupervisionWorkspaceKey) => {
    setSupervisionNavigation((current) => requestSupervisionWorkspace(current, target));
  }, []);
  const reportSupervisionDirty = useCallback((dirty: boolean) => {
    setSupervisionNavigation((current) => updateSupervisionWorkspaceDirty(current, dirty));
  }, []);
  const stayInCurrentSupervisionWorkspace = useCallback(() => {
    setSupervisionNavigation((current) => stayInSupervisionWorkspace(current));
  }, []);
  const discardCurrentSupervisionDraft = useCallback(() => {
    setSupervisionNavigation((current) => discardSupervisionWorkspaceDraft(current));
  }, []);

  async function mutate(work: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      await work();
      setNotice("更改已保存");
      setSupervisionNavigation((current) => updateSupervisionWorkspaceDirty(current, false));
      await load();
    }
    catch (nextError) { setError(message(nextError)); }
    finally { setBusy(false); }
  }

  return (
    <section className="agent-governance-workspace">
      <div className="agent-governance-toolbar">
        <div><strong>{viewTitle(activeView)}</strong><span>{viewDescription(activeView)}</span></div>
        <button className="icon-button" type="button" onClick={() => void load()} disabled={loading || busy || (activeView === "supervision" && supervisionNavigation.dirty)} title={supervisionNavigation.dirty ? "请先保存或放弃当前修改" : "刷新当前治理视图"}><RefreshCw aria-hidden="true" /></button>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="agent-success-banner" role="status">{notice}</div> : null}
      {loading ? <Loading /> : canRenderGovernanceData(loading, data) ? (
        <>
          {activeView === "supervision" ? <SupervisionView
            value={data as SupervisionData}
            models={models}
            busy={busy}
            mutate={mutate}
            navigation={supervisionNavigation}
            onSelect={selectSupervisionWorkspace}
            onDirtyChange={reportSupervisionDirty}
            onStay={stayInCurrentSupervisionWorkspace}
            onDiscard={discardCurrentSupervisionDraft}
          /> : null}
          {activeView === "activity" ? <ActivityView value={data as ActivityData} models={models} busy={busy} mutate={mutate} /> : null}
        </>
      ) : null}
    </section>
  );
}

function SupervisionView({
  value,
  models,
  busy,
  mutate,
  navigation,
  onSelect,
  onDirtyChange,
  onStay,
  onDiscard,
}: {
  value: SupervisionData;
  models: ModelRecord[];
  busy: boolean;
  mutate: (work: () => Promise<unknown>) => Promise<void>;
  navigation: SupervisionWorkspaceState;
  onSelect: (target: SupervisionWorkspaceKey) => void;
  onDirtyChange: (dirty: boolean) => void;
  onStay: () => void;
  onDiscard: () => void;
}) {
  const assistantPoolKeys = new Set(["assistant-diagnosis", "admin-assistant-diagnosis"]);
  const supervisionPools = value.models.pools.filter((pool) => !assistantPoolKeys.has(pool.poolKey));
  const supervisionDefinitions = {
    ...value.models.roles,
    definitions: value.models.roles.definitions.filter((definition) => !["assistant-planner", "admin-assistant-planner", "provider-analysis-planner"].includes(definition.agentKey)),
    pools: supervisionPools,
  };
  const plannerDefinitions = {
    ...supervisionDefinitions,
    definitions: supervisionDefinitions.definitions.filter((definition) => canvasAgentPurpose(definition.agentKey) && definition.agentKey !== "generation-recovery"),
  };
  const historicalDefinitions = supervisionDefinitions.definitions.filter((definition) => !canvasAgentPurpose(definition.agentKey));
  const activeItem = supervisionWorkspaceItems(navigation.active).find((item) => item.selected);
  const pendingItem = navigation.pending ? supervisionWorkspaceItems(navigation.pending).find((item) => item.selected) : null;

  return <div className="supervision-workbench">
    <AdminSupervisionWorkspaceNav active={navigation.active} onSelect={onSelect} />
    <div className="supervision-workspace-surface" role="tabpanel" aria-label={activeItem?.label}>
      <header className="supervision-workspace-surface__header">
        <div><strong>{activeItem?.label}</strong><span>{activeItem?.description}</span></div>
        <span className={`agent-status agent-status--${navigation.dirty ? "review" : "enabled"}`}>{navigation.dirty ? "有未保存修改" : "配置已同步"}</span>
      </header>
      {navigation.pending ? <div className="supervision-unsaved-notice" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div><strong>当前修改尚未保存</strong><span>切换到“{pendingItem?.label}”会放弃本工作区的草稿。</span></div>
        <button type="button" className="ghost-action" onClick={onStay}>留在当前页</button>
        <button type="button" className="danger-action" onClick={onDiscard}>放弃并切换</button>
      </div> : null}
      <div className="supervision-workspace-surface__content">
        {navigation.active === "overview" ? <SupervisionOverviewView value={value.overview} /> : null}
        {navigation.active === "environment" ? <EnvironmentView value={value.overview} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /> : null}
        {navigation.active === "planner" ? <PlannerView value={plannerDefinitions} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /> : null}
        {navigation.active === "routing" ? <RoutingView value={supervisionPools} historicalDefinitions={historicalDefinitions} models={models} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /> : null}
        {navigation.active === "quality" ? <QualityView value={value.policies.quality} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /> : null}
        {navigation.active === "recovery" ? <RecoveryView value={value.policies.recovery} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /> : null}
      </div>
    </div>
  </div>;
}

function ActivityView({ value, models, busy, mutate }: { value: ActivityData; models: ModelRecord[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <AdminAgentActivityWorkspace {...value} models={models} busy={busy} mutate={mutate} />;
}

function SupervisionOverviewView({ value }: { value: AgentOverview }) {
  const metrics = value?.metrics || {};
  return <div className="agent-governance-stack">
    <div className="agent-metric-grid">
      <Metric icon={<Activity />} label="活跃 Agent" value={metrics.activeAgentRuns} />
      <Metric icon={<GitBranch />} label="活跃画布运行" value={metrics.activeCanvasRuns} />
      <Metric icon={<AlertTriangle />} label="异常 LLM 路由" value={metrics.unhealthyRoutes} tone={metrics.unhealthyRoutes ? "warning" : "normal"} />
      <Metric icon={<ListChecks />} label="待审批" value={metrics.pendingApprovals} tone={metrics.pendingApprovals ? "warning" : "normal"} />
      <Metric icon={<Sparkles />} label="24h 质量评估" value={metrics.evaluations24h} />
    </div>
    <SectionHead title="执行权威" description="AI 只分析并提出受控建议；依赖图、阶段就绪条件和节点任务运行仍由确定性执行层负责。" />
    <div className="scope-note"><ShieldCheck /><span>AI 托管只作用于明确的 Workflow Region，不会创建节点、修改连线、绕过权限或改变活动 Run 的冻结快照。所有环境控制都<strong>仅影响新 Workflow Run</strong>。</span></div>
    <div className="supervision-execution-policy" aria-label="托管执行并发权威">
      <div><span>并发输入</span><strong>工作流 stageConcurrency</strong></div>
      <div><span>平台上限</span><strong>每阶段 1-16</strong></div>
      <div><span>执行规则</span><strong>新 Run 冻结后生效</strong></div>
    </div>
    <div className="supervision-environment-summary">
      {(value?.controls || []).map((control) => {
        const mode = deriveSupervisionMode(control);
        return <div key={control.environment}>
        <EnvironmentBadge value={control.environment} />
        <strong>{mode.label}</strong>
        <span>{mode.summary}</span>
      </div>;})}
    </div>
  </div>;
}

function EnvironmentView({ value, busy, mutate, onDirtyChange }: { value: AgentOverview; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [dirtyControls, setDirtyControls] = useState<Record<string, boolean>>({});
  const dirty = Object.values(dirtyControls).some(Boolean);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const handleDirtyChange = useCallback((environment: AgentEnvironment, nextDirty: boolean) => {
    setDirtyControls((current) => current[environment] === nextDirty ? current : { ...current, [environment]: nextDirty });
  }, []);

  return <div className="agent-governance-stack">
    <ActionHead title="环境托管强度" action={<button type="button" className="ghost-action" disabled={busy} onClick={() => void mutate(adminAgentGovernanceApi.bootstrap)}><Plus />初始化固定用途草稿</button>} />
    <p className="agent-section-description">选择一种可理解的托管模式；保存只改变服务端允许范围，不自动发布配置，并且仅影响新 Workflow Run。</p>
    <div className="agent-control-table">
      {(value?.controls || []).map((control) => <ControlRow key={control.environment} value={control} busy={busy} mutate={mutate} onDirtyChange={(nextDirty) => handleDirtyChange(control.environment, nextDirty)} />)}
    </div>
  </div>;
}

function ControlRow({ value, busy, mutate, onDirtyChange }: { value: AgentRuntimeControl; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const changed = !sameControl(draft, value);
  const mode = deriveSupervisionMode(draft);
  useEffect(() => onDirtyChange(changed), [changed, onDirtyChange]);
  const keys: Array<[keyof AgentRuntimeControl, string]> = [["agentEnabled", "Agent"], ["canvasRunsEnabled", "Canvas Run"], ["qualityEvaluationEnabled", "质量评估"], ["automaticRecoveryEnabled", "自动恢复"]];
  const presets: Array<{ id: SupervisionPreset; label: string; description: string }> = [
    { id: "observe", label: "仅观察", description: "计划与诊断，不自动恢复" },
    { id: "controlled", label: "受控托管", description: "质量选择，高风险动作转审批" },
    { id: "automatic", label: "自动恢复", description: "在冻结策略和预算内恢复" },
  ];
  return <div className="agent-control-row agent-control-row--modes">
    <div className="agent-control-environment"><EnvironmentBadge value={draft.environment} /><strong>{mode.label}</strong><small>revision {draft.revision} · 仅影响新 Workflow Run</small></div>
    <div className="supervision-mode-grid" role="radiogroup" aria-label={`${draft.environment} 托管模式`}>{presets.map((preset) => <button type="button" role="radio" aria-checked={mode.mode === preset.id} key={preset.id} className={mode.mode === preset.id ? "active" : ""} onClick={() => setDraft(applySupervisionPreset(draft, preset.id))}><strong>{preset.label}</strong><span>{preset.description}</span></button>)}</div>
    <div className={`supervision-mode-summary supervision-mode-summary--${mode.mode}`}><strong>{mode.summary}</strong>{mode.customReasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
    <details className="supervision-advanced-controls"><summary>高级控制</summary><div className="agent-control-toggles">{keys.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} /><span>{label}</span></label>)}</div></details>
    <button type="button" className="primary-action" disabled={busy || !changed} onClick={() => void mutate(() => adminAgentGovernanceApi.updateControls(draft))}><Check aria-hidden="true" />保存模式</button>
  </div>;
}

function PlannerView({ value, busy, mutate, onDirtyChange }: { value: AgentRoleWorkspaceData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  return <div className="agent-governance-stack">
    <SectionHead title="托管分析用途" description="配置规划、候选评估等受控 Agent。配置仅在新 Run 开始时冻结并生效。" />
    <ActionHead title={`${value.definitions.length} 个固定用途`} action={<span className="agent-status agent-status--enabled">用途受控</span>} />
    {value.definitions.length ? <AdminAgentRoleConfigurationEditor value={value} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /> : <Empty label="尚未初始化固定用途，请先在环境控制中初始化默认草稿" />}
  </div>;
}

function RoutingView({ value, historicalDefinitions, models, busy, mutate, onDirtyChange }: { value: LlmRoutePool[]; historicalDefinitions: AgentRoleWorkspaceData["definitions"]; models: ModelRecord[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [creating, setCreating] = useState(false);
  const availableTemplates = purposeRouteTemplates.filter((template) => !value.some((pool) => pool.poolKey === template.poolKey));
  const [templateId, setTemplateId] = useState<string>(purposeRouteTemplates[0].id);
  const template = availableTemplates.find((item) => item.id === templateId) || availableTemplates[0];
  return <div className="agent-governance-stack">
    <SectionHead title="LLM 路由与回退" description="路由池只接受已启用的聊天模型，并在新 Run 开始时锁定版本。" />
    <ActionHead title={`${value.length} 个 LLM 路由池`} action={<button type="button" className="primary-action" disabled={!availableTemplates.length} onClick={() => setCreating(!creating)}><Plus />按用途创建</button>} />
    <div className="scope-note"><ShieldCheck /><span>这里只接受后台模型目录中已启用的 <code>chat</code> 模型。图片、视频、音频生成模型不进入该路由池。</span></div>
    {creating && template ? <InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createPool(template))} disabled={busy} submit="创建用途路由">
      <Field label="用途"><select value={template.id} onChange={(event) => setTemplateId(event.target.value)}>{availableTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
      <Field label="固定标识"><input value={template.poolKey} disabled /></Field>
      <Field label="生效场景"><input value={template.label} disabled /></Field>
    </InlineForm> : null}
    <AdminAgentPoolEditor pools={value} models={models.filter((model) => model.capability === "chat" && model.enabled)} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} />
    <HistoricalDefinitions value={historicalDefinitions} />
  </div>;
}

function HistoricalDefinitions({ value }: { value: AgentRoleWorkspaceData["definitions"] }) {
  if (!value.length) return null;
  return <div className="agent-governance-stack">
    <SectionHead title="历史配置" description="这些定义仅用于兼容历史记录，不可从当前 MVP 编辑，也不会被新的 Canvas AI Run 自动选择。" />
    <div className="scope-note"><History /><span>保留版本和发布记录用于审计；迁移或清理必须通过后续受控流程完成。</span></div>
    <DataTable headers={["名称", "内部标识", "状态", "版本", "历史发布"]}>{value.map((definition) => <tr key={definition.id}><td><strong>{definition.name}</strong></td><td><code>{definition.agentKey}</code></td><td><StatusBadge value={definition.enabled ? "enabled" : "disabled"} /></td><td>{definition.versions.length}</td><td>{definition.publications.map((item) => item.environment === "gray" ? "Gray" : "Production").join(" / ") || "-"}</td></tr>)}</DataTable>
  </div>;
}

function QualityView({ value, busy, mutate, onDirtyChange }: { value: QualityProfile[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  return <div className="agent-governance-stack"><SectionHead title="质量与候选选择" description="质量阈值和置信度策略只作用于显式候选门。" /><AdminAgentQualityEditor value={value} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /></div>;
}

function RecoveryView({ value, busy, mutate, onDirtyChange }: { value: AgentRecoveryWorkspaceData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const roles = { ...value.roles, definitions: value.roles.definitions.filter((definition) => definition.agentKey === "generation-recovery") };
  return <div className="agent-governance-stack"><SectionHead title="恢复策略" description="恢复用途的发布配置决定工具、预算、审批与自动恢复次数。" />{roles.definitions.length ? <AdminAgentRoleConfigurationEditor value={roles} busy={busy} mutate={mutate} onDirtyChange={onDirtyChange} /> : <Empty label="尚未初始化失败恢复用途" />}<SectionHead title="恢复决策账本" description="最近的失败分类、目标模型与审批状态。" /><DataTable headers={["时间", "Owner", "失败分类", "恢复决策", "模型变化", "状态"]}>{value.decisions.map((item) => <tr key={item.id}><td>{formatTime(item.createdAt)}</td><td>{item.ownerEmail}</td><td><StatusBadge value={item.failureClass} /></td><td><strong>{item.decision}</strong><small>{item.reason}</small></td><td><code>{item.currentModelId || "-"}</code><small>{item.targetModelId && item.targetModelId !== item.currentModelId ? `→ ${item.targetModelId}` : "同配置"}</small></td><td><StatusBadge value={item.status} /></td></tr>)}</DataTable></div>;
}

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
function viewTitle(view: AdminAgentRuntimeViewId) { return ({ assistants: "AI 助手", supervision: "AI 托管与自动化", activity: "运行与审计" })[view]; }
function viewDescription(view: AdminAgentRuntimeViewId) { return ({ assistants: "创作侧与后台助手治理", supervision: "托管 planner、并发、质量、候选与恢复策略", activity: "Workflow Run、Agent Run、审批和动作证据" })[view]; }
function statusLabel(value: string) { return ({ enabled: "启用", disabled: "停用", draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役", pending: "待处理", rejected: "已拒绝", cancelled: "已取消", running: "运行中", succeeded: "成功", failed: "失败", queued: "排队", planned: "已计划", paused: "已暂停", awaiting_approval: "等待审批", healthy: "健康", degraded: "降级", circuit_open: "熔断", legacy_browser: "浏览器运行", native_server: "服务端运行", observe: "观察", execute: "执行", modify: "修改", public: "公开", internal: "内部" } as Record<string, string>)[value] || value; }
function formatTime(value: number) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-"; }
function sameControl(left: AgentRuntimeControl, right: AgentRuntimeControl) { return left.agentEnabled === right.agentEnabled && left.canvasRunsEnabled === right.canvasRunsEnabled && left.automaticRecoveryEnabled === right.automaticRecoveryEnabled && left.qualityEvaluationEnabled === right.qualityEvaluationEnabled; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
