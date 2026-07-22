import {
  Activity, AlertTriangle, Bot, Check, ChevronRight, CirclePause, Database, FileText, Gauge,
  GitBranch, ListChecks, Loader2, Play, Plus, RefreshCw, Route, ShieldCheck, SlidersHorizontal,
  Sparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ModelRecord } from "./admin-types";
import type { AdminAgentRuntimeViewId } from "./admin-view-model";
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
} from "./admin-agent-governance-api";

interface Props { activeView: AdminAgentRuntimeViewId; models: ModelRecord[] }
type Data = AgentOverview | AgentDefinition[] | LlmRoutePool[] | AgentToolData | NodeCapability[] | KnowledgeCollection[] | QualityProfile[] | RecoveryDecision[] | AgentRunsData | AgentApproval[] | AgentAuditRecord[];

export function AdminAgentGovernanceWorkspace({ activeView, models }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const next = await ({
        overview: adminAgentGovernanceApi.overview,
        roles: adminAgentGovernanceApi.roles,
        "llm-routes": adminAgentGovernanceApi.pools,
        tools: adminAgentGovernanceApi.tools,
        nodes: adminAgentGovernanceApi.nodes,
        knowledge: adminAgentGovernanceApi.knowledge,
        quality: adminAgentGovernanceApi.qualityProfiles,
        recovery: adminAgentGovernanceApi.recovery,
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
    setBusy(true); setError("");
    try { await work(); await load(); }
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
      {loading ? <Loading /> : (
        <>
          {activeView === "overview" ? <OverviewView value={data as AgentOverview} busy={busy} mutate={mutate} /> : null}
          {activeView === "roles" ? <RolesView value={data as AgentDefinition[]} busy={busy} mutate={mutate} /> : null}
          {activeView === "llm-routes" ? <PoolsView value={data as LlmRoutePool[]} models={models.filter((model) => model.capability === "chat" && model.enabled)} busy={busy} mutate={mutate} /> : null}
          {activeView === "tools" ? <ToolsView value={data as AgentToolData} busy={busy} mutate={mutate} /> : null}
          {activeView === "nodes" ? <NodesView value={data as NodeCapability[]} /> : null}
          {activeView === "knowledge" ? <KnowledgeView value={data as KnowledgeCollection[]} busy={busy} mutate={mutate} /> : null}
          {activeView === "quality" ? <QualityView value={data as QualityProfile[]} busy={busy} mutate={mutate} /> : null}
          {activeView === "recovery" ? <RecoveryView value={data as RecoveryDecision[]} /> : null}
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

function RolesView({ value, busy, mutate }: { value: AgentDefinition[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ agentKey: "", name: "", role: "planner", description: "" });
  return <div className="agent-governance-stack">
    <ActionHead title={`${value.length} 个 Agent 定义`} action={<button type="button" className="primary-action" onClick={() => setShowCreate(!showCreate)}><Plus />新建角色</button>} />
    {showCreate ? <InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createRole(form))} disabled={busy || !form.agentKey || !form.name} submit="创建角色">
      <Field label="Agent Key"><input value={form.agentKey} onChange={(event) => setForm({ ...form, agentKey: event.target.value })} /></Field>
      <Field label="名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="角色"><RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} /></Field>
      <Field label="说明"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
    </InlineForm> : null}
    <div className="agent-entity-list">{value.map((definition) => <div className="agent-entity" key={definition.id}>
      <header><div><Bot /><strong>{definition.name}</strong><code>{definition.agentKey}</code></div><StatusBadge value={definition.enabled ? "enabled" : "disabled"} /></header>
      <p>{definition.description || "未填写说明"}</p>
      <div className="agent-version-list">{definition.versions.map((version) => <VersionRow key={version.id} label={`v${version.version}`} status={version.status} publications={definition.publications.filter((item) => item.configurationVersionId === version.id)} busy={busy} onTransition={(status) => mutate(() => adminAgentGovernanceApi.transitionRoleVersion(version.id, status))} onPublish={(environment) => mutate(() => adminAgentGovernanceApi.publishRoleVersion(version.id, environment))} />)}</div>
      <button type="button" className="ghost-action" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.createRoleVersion(definition.id, { toolAllowlist: [], maxTokens: 4000, timeoutMs: 120000 }))}><Plus />新增配置草稿</button>
    </div>)}</div>
  </div>;
}

function PoolsView({ value, models, busy, mutate }: { value: LlmRoutePool[]; models: ModelRecord[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ poolKey: "", name: "", role: "planner", scenario: "assistant-chat" });
  const [selectedPool, setSelectedPool] = useState("");
  const [selectedModel, setSelectedModel] = useState(models[0]?.id || "");
  const [simulation, setSimulation] = useState("");
  useEffect(() => { if (!selectedModel && models[0]) setSelectedModel(models[0].id); }, [models, selectedModel]);
  const pool = value.find((item) => item.id === selectedPool) || value[0];
  const latest = pool?.versions[0];
  return <div className="agent-governance-stack">
    <ActionHead title={`${value.length} 个 LLM 路由池`} action={<button type="button" className="primary-action" onClick={() => setCreating(!creating)}><Plus />新建路由池</button>} />
    <div className="scope-note"><ShieldCheck /><span>这里只接受后台模型目录中已启用的 <code>chat</code> 模型。图片、视频、音频生成模型不进入该路由池。</span></div>
    {creating ? <InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createPool(form))} disabled={busy || !form.poolKey || !form.name} submit="创建路由池">
      <Field label="Pool Key"><input value={form.poolKey} onChange={(event) => setForm({ ...form, poolKey: event.target.value })} /></Field>
      <Field label="名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="角色"><RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} /></Field>
      <Field label="场景"><input value={form.scenario} onChange={(event) => setForm({ ...form, scenario: event.target.value })} /></Field>
    </InlineForm> : null}
    <div className="agent-split-layout">
      <div className="agent-rail">{value.map((item) => <button key={item.id} type="button" className={pool?.id === item.id ? "active" : ""} onClick={() => setSelectedPool(item.id)}><Route /><span><strong>{item.name}</strong><small>{item.role} · {item.scenario}</small></span><ChevronRight /></button>)}</div>
      <div className="agent-inspector">{pool ? <>
        <SectionHead title={pool.name} description={`${pool.poolKey} · ${pool.role} · ${pool.scenario}`} />
        <div className="agent-version-list">{pool.versions.map((version) => <VersionRow key={version.id} label={`v${version.version} · ${version.entries.length} 个候选`} status={version.status} publications={version.publications} busy={busy} onTransition={(status) => mutate(() => adminAgentGovernanceApi.transitionPoolVersion(version.id, status))} onPublish={(environment) => mutate(() => adminAgentGovernanceApi.publishPoolVersion(version.id, environment))} />)}</div>
        <div className="agent-inline-actions"><select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>{models.map((model) => <option key={model.id} value={model.id}>{model.displayName} · {model.providerId}</option>)}</select><button type="button" className="ghost-action" disabled={busy || !selectedModel} onClick={() => { const model = models.find((item) => item.id === selectedModel); if (model) void mutate(() => adminAgentGovernanceApi.createPoolVersion(pool.id, { policy: { failureThreshold: 3, cooldownMs: 60000 }, entries: [{ modelId: model.id, providerId: model.providerId, capabilityTags: model.advancedConfig?.capabilityTags || [], priority: 1, weight: 1, estimatedCost: 0, enabled: true }] })); }}><Plus />以所选模型创建版本</button></div>
        {latest ? <div className="agent-simulator"><strong>路由模拟</strong><button type="button" className="ghost-action" disabled={busy} onClick={async () => { setSimulation(""); try { const result = await adminAgentGovernanceApi.simulatePool({ versionId: latest.id, role: pool.role, scenario: pool.scenario, requiredCapabilityTags: [], decisionKey: `admin-preview-${Date.now()}` }); setSimulation(`${result.decision.selectedEntryId} · ${result.decision.reason}`); } catch (error) { setSimulation(message(error)); } }}><Play />运行模拟</button>{simulation ? <p>{simulation}</p> : null}</div> : null}
      </> : <Empty label="尚未创建路由池" />}</div>
    </div>
  </div>;
}

function ToolsView({ value, busy, mutate }: { value: AgentToolData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <div className="agent-governance-stack"><SectionHead title="固定工具注册表" description="工具必须先存在于代码注册表，再由策略缩小权限；后台不能添加任意 Shell 或 HTTP 工具。" />
    <div className="agent-tool-list">{value.catalog.map((tool) => { const policy = value.policies.find((item) => item.subjectType === "platform" && item.toolName === tool.name); const effect = policy?.effect || (tool.approvalRequired ? "require_approval" : "allow"); return <div className="agent-tool-row" key={tool.name}><div><strong>{tool.label}</strong><code>{tool.name}</code><p>{tool.description}</p></div><div className="agent-tool-meta"><StatusBadge value={tool.risk} /><select value={effect} disabled={busy} onChange={(event) => void mutate(() => adminAgentGovernanceApi.updateToolPolicy({ subjectType: "platform", toolName: tool.name, effect: event.target.value, constraints: {}, revision: policy?.revision }))}><option value="allow">允许</option><option value="require_approval">需审批</option><option value="deny">拒绝</option></select></div></div>; })}</div>
  </div>;
}

function NodesView({ value }: { value: NodeCapability[] }) {
  const native = value.filter((item) => item.serverRuntime === "native_server").length;
  const planEligible = value.filter((item) => item.planEligible).length;
  return <div className="agent-governance-stack"><div className="scope-note"><Database /><span>{value.length} 个维护节点，{planEligible} 个可进入 Canvas Run 计划，{native} 个已迁移服务端 runtime。目录同时进入规划、监督、检查和恢复 Agent 的受控上下文。</span></div><DataTable headers={["节点", "用途与运行", "输入 / 输出", "连接与模型", "失败与 Agent"]}>{value.map((item) => <tr key={item.nodeType}><td><strong>{item.label}</strong><code>{item.nodeType}</code></td><td><p>{item.description}</p><small>{item.executionKind} · {item.planEligible ? "可进入计划" : "仅说明"}</small><StatusBadge value={item.serverRuntime} /></td><td><small>入：{portSummary(item.inputs)}</small><small>出：{portSummary(item.outputs)}</small></td><td><small>上游：{item.recommendedUpstream.join("、") || "无"}</small><small>下游：{item.recommendedDownstream.join("、") || "无"}</small><small>能力：{item.modelCapabilityHints.join("、") || "无"}</small></td><td><small>{item.commonFailureCodes.join("、") || "无常见失败码"}</small><small>Agent：{item.agentAllowedActions.join("、") || "无"}</small></td></tr>)}</DataTable></div>;
}

function portSummary(ports: NodeCapability["inputs"]) {
  return ports.length ? ports.map((port) => `${port.key}:${port.valueTypes.join("|")}(${port.cardinality}${port.required ? "，必填" : ""})`).join("；") : "无";
}

function KnowledgeView({ value, busy, mutate }: { value: KnowledgeCollection[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ collectionKey: "public-canvas", name: "画布公开知识", description: "", audience: "public" });
  const [document, setDocument] = useState({ collectionId: value[0]?.id || "", documentKey: "", title: "", body: "" });
  useEffect(() => { if (!document.collectionId && value[0]) setDocument((current) => ({ ...current, collectionId: value[0].id })); }, [value, document.collectionId]);
  return <div className="agent-governance-stack"><div className="agent-two-forms"><InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createKnowledgeCollection(form))} disabled={busy || !form.collectionKey || !form.name} submit="创建知识集合"><Field label="集合 Key"><input value={form.collectionKey} onChange={(e) => setForm({ ...form, collectionKey: e.target.value })} /></Field><Field label="名称"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="受众"><select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="public">公开用户</option><option value="internal">内部</option></select></Field></InlineForm><InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createKnowledgeDocument(document.collectionId, { documentKey: document.documentKey, title: document.title, body: document.body, source: { kind: "maintained" } }))} disabled={busy || !document.collectionId || !document.documentKey || !document.title || !document.body} submit="创建文档草稿"><Field label="知识集合"><select value={document.collectionId} onChange={(e) => setDocument({ ...document, collectionId: e.target.value })}>{value.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="文档 Key"><input value={document.documentKey} onChange={(e) => setDocument({ ...document, documentKey: e.target.value })} /></Field><Field label="标题"><input value={document.title} onChange={(e) => setDocument({ ...document, title: e.target.value })} /></Field><Field label="正文"><textarea value={document.body} onChange={(e) => setDocument({ ...document, body: e.target.value })} /></Field></InlineForm></div>
    {value.map((collection) => <div className="agent-entity" key={collection.id}><header><div><FileText /><strong>{collection.name}</strong><code>{collection.collectionKey}</code></div><StatusBadge value={collection.audience} /></header><p>{collection.description || "未填写说明"}</p><div className="agent-version-list">{collection.documents.map((item) => <VersionRow key={item.id} label={`${item.title} · v${item.version}`} status={item.status} publications={item.publications} busy={busy} onTransition={(status) => mutate(() => adminAgentGovernanceApi.transitionKnowledgeDocument(item.id, status))} onPublish={(environment) => mutate(() => adminAgentGovernanceApi.publishKnowledgeDocument(item.id, environment))} />)}</div></div>)}
  </div>;
}

function QualityView({ value, busy, mutate }: { value: QualityProfile[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ profileKey: "image-default", mediaKind: "image", minimumOverallScore: 75, minimumConfidence: 0.7, instructions: "" });
  return <div className="agent-governance-stack"><InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createQualityProfile({ ...form, weights: form.mediaKind === "video" ? { technical: 0.2, semantic: 0.2, aesthetic: 0.15, temporalCoherence: 0.15, motionQuality: 0.15, keyframeConsistency: 0.15 } : { technical: 0.3, semantic: 0.3, aesthetic: 0.25, safety: 0.15 } }))} disabled={busy || !form.profileKey} submit="创建质量配置"><Field label="Profile Key"><input value={form.profileKey} onChange={(e) => setForm({ ...form, profileKey: e.target.value })} /></Field><Field label="媒体"><select value={form.mediaKind} onChange={(e) => setForm({ ...form, mediaKind: e.target.value })}><option value="image">图片</option><option value="video">视频</option></select></Field><Field label="最低总分"><input type="number" min="0" max="100" value={form.minimumOverallScore} onChange={(e) => setForm({ ...form, minimumOverallScore: Number(e.target.value) })} /></Field><Field label="最低置信度"><input type="number" min="0" max="1" step="0.05" value={form.minimumConfidence} onChange={(e) => setForm({ ...form, minimumConfidence: Number(e.target.value) })} /></Field></InlineForm>
    <DataTable headers={["配置", "媒体", "阈值", "状态", "环境", "操作"]}>{value.map((item) => <tr key={item.id}><td><strong>{item.profileKey}</strong><small>v{item.version}</small></td><td>{item.mediaKind === "image" ? "图片" : "视频"}</td><td>{item.minimumOverallScore} / {item.minimumConfidence}</td><td><StatusBadge value={item.status} /></td><td>{item.publications.map((publication) => <EnvironmentBadge value={publication.environment} key={publication.environment} />)}</td><td><VersionActions status={item.status} busy={busy} onTransition={(status) => mutate(() => adminAgentGovernanceApi.transitionQualityProfile(item.id, status))} onPublish={(environment) => mutate(() => adminAgentGovernanceApi.publishQualityProfile(item.id, environment))} /></td></tr>)}</DataTable>
  </div>;
}

function RunsView({ value }: { value: AgentRunsData }) { return <div className="agent-governance-stack"><SectionHead title="Agent Run" description="最近的有界规划、理解、检查与恢复运行。" /><RunTable rows={value.agentRuns} /><SectionHead title="Canvas Run" description="按画布 revision 和拓扑计划持久化的运行。" /><RunTable rows={value.canvasRuns} /></div>; }
function RecoveryView({ value }: { value: RecoveryDecision[] }) { return <DataTable headers={["时间", "Owner", "失败分类", "恢复决策", "模型变化", "状态"]}>{value.map((item) => <tr key={item.id}><td>{formatTime(item.createdAt)}</td><td>{item.ownerEmail}</td><td><StatusBadge value={item.failureClass} /></td><td><strong>{item.decision}</strong><small>{item.reason}</small></td><td><code>{item.currentModelId || "-"}</code><small>{item.targetModelId && item.targetModelId !== item.currentModelId ? `→ ${item.targetModelId}` : "同配置"}</small></td><td><StatusBadge value={item.status} /></td></tr>)}</DataTable>; }
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
