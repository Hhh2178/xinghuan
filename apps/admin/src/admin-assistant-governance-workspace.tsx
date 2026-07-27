import {
  Bot, Check, CheckCircle2, ChevronRight, FlaskConical, Loader2, RefreshCw, Save,
  ShieldCheck, Sparkles, WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "./admin-api-client";
import { AdminAgentPoolEditor } from "./admin-agent-pool-editor";
import { AdminAgentRoleConfigurationEditor } from "./admin-agent-role-configuration-editor";
import {
  adminAgentGovernanceApi,
  type AgentEnvironment,
  type AgentRoleWorkspaceData,
} from "./admin-agent-governance-api";
import {
  deriveAssistantLifecycle,
  type AssistantLifecycleStepId,
} from "./admin-assistant-lifecycle";
import {
  assistantGovernanceAgentKey,
  selectAssistantDefinition,
  selectAssistantRoutePools,
  type AssistantGovernanceSurface,
} from "./admin-assistant-governance-view-model";
import type { AssistantSettings, ModelRecord } from "./admin-types";

interface Props {
  settings: AssistantSettings;
  models: ModelRecord[];
  saving: boolean;
  onSave: (settings: AssistantSettings) => Promise<void>;
}

interface VerificationResult {
  surface: AssistantGovernanceSurface;
  environment: AgentEnvironment;
  status: "succeeded" | "failed";
  verifiedAt: number;
  detail: string;
}

const lifecycleSteps: Array<{ id: AssistantLifecycleStepId; label: string; description: string }> = [
  { id: "capability", label: "助手能力", description: "名称、范围与权限" },
  { id: "routing", label: "模型路由", description: "主模型与故障回退" },
  { id: "publication", label: "审核发布", description: "Gray / Production" },
  { id: "verification", label: "生效验证", description: "真实对话与诊断" },
];

export function AdminAssistantGovernanceWorkspace({ settings, models, saving, onSave }: Props) {
  const [surface, setSurface] = useState<AssistantGovernanceSurface>("frontend");
  const [environment, setEnvironment] = useState<AgentEnvironment>("production");
  const [runtimeEnvironment, setRuntimeEnvironment] = useState<AgentEnvironment | "local" | null>(null);
  const [activeStep, setActiveStep] = useState<AssistantLifecycleStepId>("capability");
  const [draft, setDraft] = useState(settings);
  const [workspace, setWorkspace] = useState<AgentRoleWorkspaceData | null>(null);
  const [lastVerification, setLastVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setDraft(settings), [settings]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setWorkspace(await adminAgentGovernanceApi.roleWorkspace());
    } catch (nextError) {
      setError(message(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void api<{ environment?: string }>("/api/status").then((status) => {
      const current = status.environment === "gray" || status.environment === "production" ? status.environment : "local";
      setRuntimeEnvironment(current);
      if (current !== "local") setEnvironment(current);
    }).catch(() => setRuntimeEnvironment("local"));
  }, []);

  const definition = useMemo(
    () => selectAssistantDefinition(workspace?.definitions || [], draft.integration, surface),
    [workspace?.definitions, draft.integration, surface],
  );
  const pools = useMemo(
    () => selectAssistantRoutePools(workspace?.pools || [], surface),
    [workspace?.pools, surface],
  );
  const surfaceWorkspace = useMemo<AgentRoleWorkspaceData | null>(() => workspace ? {
    ...workspace,
    definitions: definition ? [definition] : [],
    pools,
  } : null, [workspace, definition, pools]);
  const verification = lastVerification?.surface === surface && lastVerification.environment === environment
    ? lastVerification
    : null;
  const lifecycle = useMemo(() => deriveAssistantLifecycle({
    enabled: surfaceSettings(draft, surface).enabled,
    environment,
    definition,
    pools,
    lastVerification: verification,
  }), [definition, draft, environment, pools, surface, verification]);

  useEffect(() => setActiveStep(lifecycle.currentStep), [environment, surface]);

  async function mutate(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice("治理版本已更新，发布状态已重新校验");
      setLastVerification(null);
      await load();
    } catch (nextError) {
      setError(message(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function saveSurfaceSettings() {
    setError("");
    setNotice("");
    try {
      await onSave(draft);
      setNotice("助手能力设置已保存，只影响后续新会话");
      setLastVerification(null);
    } catch (nextError) {
      setError(message(nextError));
    }
  }

  async function verifyAssistant() {
    setBusy(true);
    setError("");
    setNotice("");
    const verifiedAt = Date.now();
    try {
      if (runtimeEnvironment !== environment) {
        throw new Error(`当前页面运行于 ${runtimeEnvironment || "未知环境"}，不能记为 ${environment === "gray" ? "Gray" : "Production"} 验证。请在目标环境打开后台后重新执行。`);
      }
      const endpoint = surface === "backend" ? "/api/admin/assistant/chat" : "/api/assistant/chat";
      const result = await api<{ mode?: string; content?: { markdown?: string }; message?: string }>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "请用一句话确认当前助手已经按已发布配置工作。",
          attachments: [],
          scope: surface === "backend" ? "admin" : "public",
          conversationId: `admin-governance-${surface}-${verifiedAt}`,
          idempotencyKey: globalThis.crypto?.randomUUID?.() || `verify-${verifiedAt}`,
        }),
      });
      if (result.mode !== "agent") {
        throw new Error("真实请求进入受限模式，Agent 或模型路由仍未在当前环境完整生效。");
      }
      setLastVerification({
        surface,
        environment,
        status: "succeeded",
        verifiedAt,
        detail: `Agent 模式 · ${result.content?.markdown || result.message || "请求已完成"}`,
      });
      setNotice("真实助手请求已完成");
    } catch (nextError) {
      const detail = message(nextError);
      setLastVerification({ surface, environment, status: "failed", verifiedAt, detail });
      setError(detail);
    } finally {
      setBusy(false);
    }
  }

  const activeAgentKey = assistantGovernanceAgentKey(draft.integration, surface);
  const plannerDefinitions = (workspace?.definitions || []).filter((item) => item.role === "planner");
  const chatModels = models.filter((model) => model.capability === "chat" && model.enabled);

  return <section className="assistant-governance-workspace">
    <header className="assistant-governance-workspace__header">
      <div><strong>AI 助手</strong><span>选择模型、启用助手、完成发布，并用真实请求确认已经生效。</span></div>
      <div className="assistant-governance-workspace__header-actions">
        <div className="assistant-environment-switch" role="group" aria-label="检查环境">
          {(["gray", "production"] as const).map((item) => <button type="button" key={item} className={environment === item ? "active" : ""} onClick={() => setEnvironment(item)}>{item === "gray" ? "Gray" : "Production"}</button>)}
        </div>
        <button type="button" className="icon-button" title="刷新助手治理数据" onClick={() => void load()} disabled={loading || busy}><RefreshCw aria-hidden="true" /></button>
      </div>
    </header>

    <div className="assistant-governance-segments" role="tablist" aria-label="助手表面">
      <button type="button" role="tab" aria-selected={surface === "frontend"} className={surface === "frontend" ? "active" : ""} onClick={() => setSurface("frontend")}><Sparkles aria-hidden="true" /><span><strong>创作侧助手</strong><small>画布、节点、工作流与托管诊断</small></span></button>
      <button type="button" role="tab" aria-selected={surface === "backend"} className={surface === "backend" ? "active" : ""} onClick={() => setSurface("backend")}><Bot aria-hidden="true" /><span><strong>后台 AI 助手</strong><small>Provider、模型、任务与审计诊断</small></span></button>
    </div>

    {error ? <div className="error-banner">{error}</div> : null}
    {notice ? <div className="agent-success-banner" role="status">{notice}</div> : null}

    <div className="assistant-readiness-band">
      <div><span>当前结论</span><strong className={lifecycle.complete ? "is-ready" : "needs-action"}>{lifecycle.conclusion}</strong></div>
      <div><span>助手配置</span><strong>{lifecycle.agentVersionLabel}</strong></div>
      <div><span>模型路由</span><strong>{lifecycle.routeVersionLabel}</strong></div>
      <div><span>最近验证</span><strong>{verification ? formatVerification(verification) : runtimeEnvironment && runtimeEnvironment !== environment ? `需在 ${environment === "gray" ? "Gray" : "Production"} 执行` : "尚未验证"}</strong></div>
    </div>

    <div className="assistant-lifecycle-track" role="tablist" aria-label="助手生效流程">
      {lifecycleSteps.map((step, index) => {
        const hasIssue = lifecycle.issues.some((issue) => issue.step === step.id);
        const selected = activeStep === step.id;
        return <button type="button" role="tab" aria-selected={selected} key={step.id} className={`${selected ? "active" : ""}${hasIssue ? " needs-action" : " complete"}`} onClick={() => setActiveStep(step.id)}><span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.description}</small></div><ChevronRight aria-hidden="true" /></button>;
      })}
    </div>

    {loading ? <div className="starlight-page-loading"><Loader2 className="spin" />正在加载助手治理数据...</div> : surfaceWorkspace ? <div className="assistant-lifecycle-surface">
      {activeStep === "capability" ? <CapabilityStep draft={draft} settings={settings} surface={surface} plannerDefinitions={plannerDefinitions} activeAgentKey={activeAgentKey} saving={saving} onDraft={setDraft} onSave={saveSurfaceSettings} workspace={surfaceWorkspace} busy={busy} mutate={mutate} /> : null}
      {activeStep === "routing" ? <LifecycleSection title="选择模型路由" description="候选顺序决定技术失败时的回退顺位；只显示已启用的聊天模型。">{pools.length ? <AdminAgentPoolEditor pools={pools} models={chatModels} busy={busy} mutate={mutate} publicationMode="manage" displayMode="configuration" /> : <BootstrapPrompt activeAgentKey={activeAgentKey} busy={busy} mutate={mutate} />}</LifecycleSection> : null}
      {activeStep === "publication" ? <LifecycleSection title="审核与发布" description={`发布到 ${environment === "gray" ? "Gray" : "Production"} 后，仅影响后续新 Agent Run；Production 发布和任何回滚都会再次确认影响。`}><PublicationChecks lifecycle={lifecycle} />{definition ? <AdminAgentRoleConfigurationEditor value={surfaceWorkspace} busy={busy} mutate={mutate} publicationMode="manage" displayMode="publication" /> : <BootstrapPrompt activeAgentKey={activeAgentKey} busy={busy} mutate={mutate} />}{pools.length ? <AdminAgentPoolEditor pools={pools} models={chatModels} busy={busy} mutate={mutate} publicationMode="manage" displayMode="publication" /> : null}</LifecycleSection> : null}
      {activeStep === "verification" ? <LifecycleSection title="验证已生效" description="发送一条真实请求，确认当前助手能使用已发布 Agent 与模型路由完成响应。"><div className="assistant-verification-panel"><FlaskConical aria-hidden="true" /><div><strong>{verification?.status === "succeeded" ? "验证成功" : verification?.status === "failed" ? "验证失败" : "尚未验证"}</strong><span>{verification?.detail || "发布完成后执行验证；受限模式不会计为完整生效。"}</span></div><button type="button" className="primary-action" disabled={busy || lifecycle.issues.some((issue) => issue.step !== "verification")} onClick={() => void verifyAssistant()}>{busy ? <Loader2 className="spin" /> : <CheckCircle2 />}发送真实验证请求</button></div></LifecycleSection> : null}
    </div> : null}
  </section>;
}

function CapabilityStep({ draft, settings, surface, plannerDefinitions, activeAgentKey, saving, onDraft, onSave, workspace, busy, mutate }: {
  draft: AssistantSettings; settings: AssistantSettings; surface: AssistantGovernanceSurface; plannerDefinitions: AgentRoleWorkspaceData["definitions"]; activeAgentKey: string; saving: boolean; onDraft: (value: AssistantSettings) => void; onSave: () => Promise<void>; workspace: AgentRoleWorkspaceData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void>;
}) {
  return <LifecycleSection title="助手能力" description="决定入口是否显示、允许附带哪些上下文，以及当前表面绑定哪个固定 Agent。">
    <div className="assistant-governance-settings">
      <div className="assistant-governance-settings__heading"><div><strong>{surface === "frontend" ? "创作侧助手" : "后台 AI 助手"}</strong><span>表面权限和 Agent 运行配置保持独立。</span></div><span className={`agent-status agent-status--${surfaceSettings(draft, surface).enabled ? "enabled" : "disabled"}`}>{surfaceSettings(draft, surface).enabled ? "启用" : "停用"}</span></div>
      <div className="assistant-governance-settings__grid">
        <label className="agent-field"><span>显示名称</span><input value={surfaceSettings(draft, surface).title} onChange={(event) => onDraft(updateSurface(draft, surface, { title: event.target.value }))} /></label>
        <label className="agent-field"><span>输入占位</span><input value={surfaceSettings(draft, surface).placeholder} onChange={(event) => onDraft(updateSurface(draft, surface, { placeholder: event.target.value }))} /></label>
        <label className="agent-field assistant-governance-settings__agent"><span>Agent 定义</span><select value={activeAgentKey} onChange={(event) => onDraft(updateAgentKey(draft, surface, event.target.value))}>{plannerDefinitions.map((item) => <option key={item.id} value={item.agentKey}>{item.name} · {item.agentKey}</option>)}</select></label>
      </div>
      <div className="assistant-governance-toggles">
        <Toggle label="启用当前助手" checked={surfaceSettings(draft, surface).enabled} onChange={(enabled) => onDraft(updateSurface(draft, surface, { enabled }))} />
        {surface === "frontend" ? <><Toggle label="工作流上下文" checked={draft.frontend.allowWorkflowAttachment} onChange={(allowWorkflowAttachment) => onDraft({ ...draft, frontend: { ...draft.frontend, allowWorkflowAttachment } })} /><Toggle label="节点上下文" checked={draft.frontend.allowNodeAttachment} onChange={(allowNodeAttachment) => onDraft({ ...draft, frontend: { ...draft.frontend, allowNodeAttachment } })} /><Toggle label="媒体附件" checked={draft.frontend.allowMediaAttachment} onChange={(allowMediaAttachment) => onDraft({ ...draft, frontend: { ...draft.frontend, allowMediaAttachment } })} /></> : <><Toggle label="默认展开" checked={draft.backend.defaultOpen} onChange={(defaultOpen) => onDraft({ ...draft, backend: { ...draft.backend, defaultOpen } })} /><Toggle label="Provider 上下文" checked={draft.backend.allowProviderContext} onChange={(allowProviderContext) => onDraft({ ...draft, backend: { ...draft.backend, allowProviderContext } })} /><Toggle label="模型上下文" checked={draft.backend.allowModelContext} onChange={(allowModelContext) => onDraft({ ...draft, backend: { ...draft.backend, allowModelContext } })} /><Toggle label="任务上下文" checked={draft.backend.allowTaskContext} onChange={(allowTaskContext) => onDraft({ ...draft, backend: { ...draft.backend, allowTaskContext } })} /><Toggle label="审计上下文" checked={draft.backend.allowAuditContext} onChange={(allowAuditContext) => onDraft({ ...draft, backend: { ...draft.backend, allowAuditContext } })} /></>}
      </div>
      <div className="assistant-governance-settings__actions"><span>revision {draft.revision}</span><button type="button" className="primary-action" disabled={saving || sameSettings(draft, settings)} onClick={() => void onSave()}><Save aria-hidden="true" />保存助手能力</button></div>
    </div>
    <details className="assistant-advanced-strategy"><summary><WandSparkles aria-hidden="true" /><span><strong>高级策略</strong><small>提示词、Token、超时、成本和审批策略</small></span></summary><AdminAgentRoleConfigurationEditor value={workspace} busy={busy} mutate={mutate} publicationMode="manage" displayMode="configuration" /></details>
  </LifecycleSection>;
}

function LifecycleSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="assistant-lifecycle-section"><header><div><strong>{title}</strong><span>{description}</span></div></header>{children}</section>;
}

function PublicationChecks({ lifecycle }: { lifecycle: ReturnType<typeof deriveAssistantLifecycle> }) {
  return <div className="assistant-publication-checks"><div><ShieldCheck aria-hidden="true" /><span><strong>生效检查</strong><small>系统会指出缺少的步骤，不再只显示内部版本号。</small></span></div>{lifecycle.issues.length ? lifecycle.issues.map((item) => <div key={item.code} className="needs-action"><span>!</span><div><strong>{item.message}</strong><small>{item.step === "verification" ? "发布完成后执行真实请求" : "完成后重新读取权威发布状态"}</small></div></div>) : <div className="complete"><Check aria-hidden="true" /><div><strong>配置与发布均已就绪</strong><small>下一步执行真实验证。</small></div></div>}</div>;
}

function BootstrapPrompt({ activeAgentKey, busy, mutate }: { activeAgentKey: string; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <div className="agent-empty"><span>未找到 {activeAgentKey} 的固定定义或路由池。</span><button type="button" className="primary-action" disabled={busy} onClick={() => void mutate(adminAgentGovernanceApi.bootstrap)}><Check aria-hidden="true" />初始化固定用途草稿</button></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="agent-toggle-field"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function surfaceSettings(settings: AssistantSettings, surface: AssistantGovernanceSurface) {
  return surface === "frontend" ? settings.frontend : settings.backend;
}

function updateSurface(settings: AssistantSettings, surface: AssistantGovernanceSurface, patch: { enabled?: boolean; title?: string; placeholder?: string }): AssistantSettings {
  return surface === "frontend" ? { ...settings, frontend: { ...settings.frontend, ...patch } } : { ...settings, backend: { ...settings.backend, ...patch } };
}

function updateAgentKey(settings: AssistantSettings, surface: AssistantGovernanceSurface, agentKey: string): AssistantSettings {
  return { ...settings, integration: surface === "frontend" ? { ...settings.integration, frontendAssistantAgentKey: agentKey } : { ...settings.integration, backendAssistantAgentKey: agentKey } };
}

function sameSettings(left: AssistantSettings, right: AssistantSettings) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatVerification(value: VerificationResult) {
  return `${value.status === "succeeded" ? "成功" : "失败"} · ${new Date(value.verifiedAt).toLocaleTimeString("zh-CN", { hour12: false })}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
