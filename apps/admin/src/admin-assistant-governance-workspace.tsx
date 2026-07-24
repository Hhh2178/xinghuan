import { Bot, Check, Loader2, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssistantSettings, ModelRecord } from "./admin-types";
import { AdminAgentPoolEditor } from "./admin-agent-pool-editor";
import { AdminAgentRoleConfigurationEditor } from "./admin-agent-role-configuration-editor";
import {
  adminAgentGovernanceApi,
  type AgentDefinition,
  type AgentRoleWorkspaceData,
  type LlmRoutePool,
} from "./admin-agent-governance-api";
import {
  assistantGovernanceAgentKey,
  selectAssistantDefinition,
  selectAssistantRoutePools,
  type AssistantGovernanceSurface,
} from "./admin-assistant-governance-view-model";

interface Props {
  settings: AssistantSettings;
  models: ModelRecord[];
  saving: boolean;
  onSave: (settings: AssistantSettings) => Promise<void>;
}

export function AdminAssistantGovernanceWorkspace({ settings, models, saving, onSave }: Props) {
  const [surface, setSurface] = useState<AssistantGovernanceSurface>("frontend");
  const [draft, setDraft] = useState(settings);
  const [workspace, setWorkspace] = useState<AgentRoleWorkspaceData | null>(null);
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

  async function mutate(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice("治理草稿已更新");
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
      setNotice("助手表面设置已保存");
    } catch (nextError) {
      setError(message(nextError));
    }
  }

  const activeAgentKey = assistantGovernanceAgentKey(draft.integration, surface);
  const plannerDefinitions = (workspace?.definitions || []).filter((item) => item.role === "planner");
  const chatModels = models.filter((model) => model.capability === "chat" && model.enabled);

  return <section className="assistant-governance-workspace">
    <header className="assistant-governance-workspace__header">
      <div>
        <strong>AI 助手</strong>
        <span>分别管理创作侧与后台助手。表面设置和项目内 Agent Runtime 保持独立版本与权限边界。</span>
      </div>
      <button type="button" className="icon-button" title="刷新助手治理数据" onClick={() => void load()} disabled={loading || busy}><RefreshCw aria-hidden="true" /></button>
    </header>

    <div className="assistant-governance-segments" role="tablist" aria-label="助手表面">
      <button type="button" role="tab" aria-selected={surface === "frontend"} className={surface === "frontend" ? "active" : ""} onClick={() => setSurface("frontend")}><Sparkles aria-hidden="true" /><span><strong>创作侧助手</strong><small>画布、节点、工作流与托管诊断</small></span></button>
      <button type="button" role="tab" aria-selected={surface === "backend"} className={surface === "backend" ? "active" : ""} onClick={() => setSurface("backend")}><Bot aria-hidden="true" /><span><strong>后台 AI 助手</strong><small>任务、Provider、模型与审计诊断</small></span></button>
    </div>

    {error ? <div className="error-banner">{error}</div> : null}
    {notice ? <div className="agent-success-banner" role="status">{notice}</div> : null}

    <div className="assistant-governance-settings">
      <div className="assistant-governance-settings__heading"><div><strong>助手表面设置</strong><span>控制名称、输入提示、附件范围和当前使用的 Agent 定义。</span></div><span className={`agent-status agent-status--${surfaceSettings(draft, surface).enabled ? "enabled" : "disabled"}`}>{surfaceSettings(draft, surface).enabled ? "启用" : "停用"}</span></div>
      <div className="assistant-governance-settings__grid">
        <label className="agent-field"><span>显示名称</span><input value={surfaceSettings(draft, surface).title} onChange={(event) => setDraft(updateSurface(draft, surface, { title: event.target.value }))} /></label>
        <label className="agent-field"><span>输入占位</span><input value={surfaceSettings(draft, surface).placeholder} onChange={(event) => setDraft(updateSurface(draft, surface, { placeholder: event.target.value }))} /></label>
        <label className="agent-field assistant-governance-settings__agent"><span>Agent 定义</span><select value={activeAgentKey} onChange={(event) => setDraft(updateAgentKey(draft, surface, event.target.value))}>{plannerDefinitions.map((item) => <option key={item.id} value={item.agentKey}>{item.name} · {item.agentKey}</option>)}</select></label>
      </div>
      <div className="assistant-governance-toggles">
        <Toggle label="启用当前助手" checked={surfaceSettings(draft, surface).enabled} onChange={(enabled) => setDraft(updateSurface(draft, surface, { enabled }))} />
        {surface === "frontend" ? <>
          <Toggle label="工作流上下文" checked={draft.frontend.allowWorkflowAttachment} onChange={(allowWorkflowAttachment) => setDraft({ ...draft, frontend: { ...draft.frontend, allowWorkflowAttachment } })} />
          <Toggle label="节点上下文" checked={draft.frontend.allowNodeAttachment} onChange={(allowNodeAttachment) => setDraft({ ...draft, frontend: { ...draft.frontend, allowNodeAttachment } })} />
          <Toggle label="媒体附件" checked={draft.frontend.allowMediaAttachment} onChange={(allowMediaAttachment) => setDraft({ ...draft, frontend: { ...draft.frontend, allowMediaAttachment } })} />
        </> : <>
          <Toggle label="默认展开" checked={draft.backend.defaultOpen} onChange={(defaultOpen) => setDraft({ ...draft, backend: { ...draft.backend, defaultOpen } })} />
          <Toggle label="Provider 上下文" checked={draft.backend.allowProviderContext} onChange={(allowProviderContext) => setDraft({ ...draft, backend: { ...draft.backend, allowProviderContext } })} />
          <Toggle label="模型上下文" checked={draft.backend.allowModelContext} onChange={(allowModelContext) => setDraft({ ...draft, backend: { ...draft.backend, allowModelContext } })} />
          <Toggle label="任务上下文" checked={draft.backend.allowTaskContext} onChange={(allowTaskContext) => setDraft({ ...draft, backend: { ...draft.backend, allowTaskContext } })} />
          <Toggle label="审计上下文" checked={draft.backend.allowAuditContext} onChange={(allowAuditContext) => setDraft({ ...draft, backend: { ...draft.backend, allowAuditContext } })} />
        </>}
      </div>
      <div className="assistant-governance-settings__actions"><span>revision {draft.revision}</span><button type="button" className="primary-action" disabled={saving || sameSettings(draft, settings)} onClick={() => void saveSurfaceSettings()}><Save aria-hidden="true" />保存当前助手设置</button></div>
    </div>

    {loading ? <div className="starlight-page-loading"><Loader2 className="spin" />正在加载助手治理数据...</div> : surfaceWorkspace ? <>
      <PublicationVisibility definition={definition} pools={pools} />
      {!definition ? <BootstrapPrompt activeAgentKey={activeAgentKey} busy={busy} mutate={mutate} /> : <>
        <div className="agent-section-head"><strong>Agent 内核与策略</strong><span>编辑只会创建新草稿；Gray 与 Production 的当前发布状态在上方只读展示。</span></div>
        <AdminAgentRoleConfigurationEditor key={definition.id} value={surfaceWorkspace} busy={busy} mutate={mutate} publicationMode="read-only" />
      </>}
      <div className="agent-section-head"><strong>LLM 路由池</strong><span>只显示当前助手用途的聊天模型路由，不混入另一侧助手或生成模型。</span></div>
      {pools.length ? <AdminAgentPoolEditor key={pools.map((pool) => pool.poolKey).join(":")} pools={pools} models={chatModels} busy={busy} mutate={mutate} publicationMode="read-only" /> : <BootstrapPrompt activeAgentKey={activeAgentKey} busy={busy} mutate={mutate} />}
    </> : null}
  </section>;
}

function PublicationVisibility({ definition, pools }: { definition?: AgentDefinition; pools: LlmRoutePool[] }) {
  return <div className="assistant-publication-visibility">
    <div><ShieldCheck aria-hidden="true" /><span><strong>环境发布状态</strong><small>只读显示，不在此工作台切换 Gray 或 Production。</small></span></div>
    {(["gray", "production"] as const).map((environment) => {
      const publication = definition?.publications.find((item) => item.environment === environment);
      const version = definition?.versions.find((item) => item.id === publication?.configurationVersionId);
      const routeVersion = pools.flatMap((pool) => pool.versions).find((item) => item.publications.some((itemPublication) => itemPublication.environment === environment));
      return <div key={environment}><span className={`agent-environment agent-environment--${environment}`}>{environment === "gray" ? "Gray" : "Production"}</span><strong>{version ? `Agent v${version.version}` : "Agent 未发布"}</strong><small>{routeVersion ? `路由 v${routeVersion.version}` : "路由未发布"}</small></div>;
    })}
  </div>;
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
  return surface === "frontend"
    ? { ...settings, frontend: { ...settings.frontend, ...patch } }
    : { ...settings, backend: { ...settings.backend, ...patch } };
}

function updateAgentKey(settings: AssistantSettings, surface: AssistantGovernanceSurface, agentKey: string): AssistantSettings {
  return {
    ...settings,
    integration: surface === "frontend"
      ? { ...settings.integration, frontendAssistantAgentKey: agentKey }
      : { ...settings.integration, backendAssistantAgentKey: agentKey },
  };
}

function sameSettings(left: AssistantSettings, right: AssistantSettings) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
