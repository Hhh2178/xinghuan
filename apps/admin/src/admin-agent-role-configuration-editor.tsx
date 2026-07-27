import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Plus, Save } from "lucide-react";
import { diffAgentRuntimeConfiguration, normalizeAgentRuntimeConfiguration, type AgentRuntimeConfiguration } from "@xinghuan/agent-core";

import {
  adminAgentGovernanceApi,
  type AgentDefinition,
  type AgentEnvironment,
  type AgentRoleWorkspaceData,
  type AgentVersionStatus,
} from "./admin-agent-governance-api";
import { canvasAgentPurpose } from "./admin-agent-governance-purpose";

interface Props {
  value: AgentRoleWorkspaceData;
  busy: boolean;
  mutate: (work: () => Promise<unknown>) => Promise<void>;
  publicationMode?: "manage" | "read-only";
  displayMode?: "full" | "configuration" | "publication";
  onDirtyChange?: (dirty: boolean) => void;
}

export function AdminAgentRoleConfigurationEditor({ value, busy, mutate, publicationMode = "manage", displayMode = "full", onDirtyChange }: Props) {
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(value.definitions[0]?.id || "");
  const definition = value.definitions.find((item) => item.id === selectedDefinitionId) || value.definitions[0];
  const [sourceVersionId, setSourceVersionId] = useState(definition?.versions[0]?.id || "");
  const sourceVersion = definition?.versions.find((item) => item.id === sourceVersionId) || definition?.versions[0];
  const [draft, setDraft] = useState<AgentRuntimeConfiguration>(() => normalizeAgentRuntimeConfiguration(sourceVersion?.configuration, { retiredTools: "preserve" }));

  useEffect(() => {
    if (!definition) return;
    const next = definition.versions[0];
    setSourceVersionId(next?.id || "");
    setDraft(normalizeAgentRuntimeConfiguration(next?.configuration, { retiredTools: "preserve" }));
  }, [definition?.id]);
  useEffect(() => {
    setDraft(normalizeAgentRuntimeConfiguration(sourceVersion?.configuration, { retiredTools: "preserve" }));
  }, [sourceVersion?.id]);

  const diff = useMemo(() => diffAgentRuntimeConfiguration(normalizeAgentRuntimeConfiguration(sourceVersion?.configuration, { retiredTools: "preserve" }), draft), [sourceVersion?.configuration, draft]);
  useEffect(() => onDirtyChange?.(diff.length > 0), [diff.length, onDirtyChange]);
  if (!definition) return <div className="agent-empty">尚未创建 Agent 定义</div>;

  return <div className="agent-split-layout agent-config-editor">
    <div className="agent-rail" role="tablist" aria-label="AI 用途">
      {value.definitions.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === definition.id} className={item.id === definition.id ? "active" : ""} onClick={() => setSelectedDefinitionId(item.id)}>
        <span><strong>{canvasAgentPurpose(item.agentKey)?.label || item.name}</strong><small>{canvasAgentPurpose(item.agentKey)?.description || item.description}</small></span>
      </button>)}
    </div>
    <div className="agent-inspector agent-config-editor__inspector">
      <header className="agent-config-editor__header"><div><strong>{canvasAgentPurpose(definition.agentKey)?.label || definition.name}</strong><span>{definition.description || definition.agentKey} 配置只对新 Run 生效。</span></div><span className={`agent-status agent-status--${definition.enabled ? "enabled" : "disabled"}`}>{definition.enabled ? "启用" : "停用"}</span></header>
      {displayMode !== "publication" ? <div className="agent-config-editor__version-bar">
        <label><span>基准版本</span><select value={sourceVersion?.id || ""} onChange={(event) => setSourceVersionId(event.target.value)}>{definition.versions.map((version) => <option value={version.id} key={version.id}>v{version.version} · {statusLabel(version.status)}</option>)}</select></label>
        <button type="button" className="ghost-action" disabled={busy || !sourceVersion} onClick={() => sourceVersion && void mutate(() => adminAgentGovernanceApi.cloneRoleVersion(sourceVersion.id))}><Copy />复制为草稿</button>
      </div> : null}

      {displayMode !== "publication" ? <>
      <section className="agent-config-section">
        <h3>用途与提示词</h3>
        <label className="agent-field"><span>用途说明</span><input value={draft.roleDescription} onChange={(event) => setDraft({ ...draft, roleDescription: event.target.value })} /></label>
        <label className="agent-field"><span>系统提示词模板</span><textarea rows={6} value={draft.promptTemplate} onChange={(event) => setDraft({ ...draft, promptTemplate: event.target.value })} /></label>
      </section>

      <section className="agent-config-section agent-config-grid">
        <h3>模型与运行预算</h3>
        <label className="agent-field"><span>LLM 路由池</span><select value={draft.llmPoolKey} onChange={(event) => setDraft({ ...draft, llmPoolKey: event.target.value })}><option value="">按角色与场景解析</option>{value.pools.filter((pool) => pool.role === definition.role).map((pool) => <option value={pool.poolKey} key={pool.id}>{pool.name} · {pool.scenario}</option>)}</select></label>
        <NumberField label="最大 Tokens" value={draft.maxTokens} min={128} max={64000} onChange={(maxTokens) => setDraft({ ...draft, maxTokens })} />
        <NumberField label="超时 (ms)" value={draft.timeoutMs} min={1000} max={600000} onChange={(timeoutMs) => setDraft({ ...draft, timeoutMs })} />
        <NumberField label="最大估算成本" value={draft.budget.maximumEstimatedCost ?? 0} min={0} max={1000000} step={0.01} onChange={(maximumEstimatedCost) => setDraft({ ...draft, budget: { maximumEstimatedCost } })} />
        <label className="agent-field"><span>质量配置</span><select value={draft.qualityProfileKey} onChange={(event) => setDraft({ ...draft, qualityProfileKey: event.target.value })}><option value="">不绑定</option>{value.qualityProfiles.map((profile) => <option value={profile.profileKey} key={profile.id}>{profile.profileKey} · v{profile.version}</option>)}</select></label>
      </section>

      <section className="agent-config-section agent-config-grid">
        <h3>审批与恢复</h3>
        <label className="agent-field"><span>结构修改</span><select value="required" disabled><option value="required">必须审批</option></select></label>
        <label className="agent-field"><span>生成模型切换</span><select value={draft.approvalPolicy.generationModelSwitch} onChange={(event) => setDraft({ ...draft, approvalPolicy: { ...draft.approvalPolicy, generationModelSwitch: event.target.value === "policy" ? "policy" : "required" } })}><option value="required">必须审批</option><option value="policy">按发布策略</option></select></label>
        <label className="agent-toggle-field"><input type="checkbox" checked={draft.automaticRecovery.enabled} onChange={(event) => setDraft({ ...draft, automaticRecovery: { ...draft.automaticRecovery, enabled: event.target.checked } })} /><span>允许自动恢复</span></label>
        <NumberField label="最多恢复次数" value={draft.automaticRecovery.maxAttempts} min={0} max={20} onChange={(maxAttempts) => setDraft({ ...draft, automaticRecovery: { ...draft.automaticRecovery, maxAttempts } })} />
      </section>

      <section className="agent-config-section">
        <h3>结构化差异</h3>
        {diff.length ? <div className="agent-config-diff">{diff.map((entry) => <div key={entry.field}><code>{entry.field}</code><span>{display(entry.before)}</span><strong>→</strong><span>{display(entry.after)}</span></div>)}</div> : <p className="agent-config-empty">与基准版本一致</p>}
      </section>

      <div className="agent-config-editor__actions"><span>{diff.length ? `${diff.length} 项配置待保存` : "与基准版本一致"}</span><button type="button" className="primary-action" disabled={busy || diff.length === 0} onClick={() => void mutate(() => adminAgentGovernanceApi.createRoleVersion(definition.id, normalizeAgentRuntimeConfiguration(draft)))}><Save />保存为新草稿</button></div>
      </> : null}
      {displayMode !== "configuration" ? <section className="agent-version-history"><header><strong>Agent 版本历史</strong><span>批准与发布只影响之后创建的新 Agent Run</span></header><div className="agent-version-list">{definition.versions.map((version) => <RoleVersionRow key={version.id} definition={definition} version={version} busy={busy} mutate={mutate} publicationMode={publicationMode} />)}</div></section> : null}
    </div>
  </div>;
}

function RoleVersionRow({ definition, version, busy, mutate, publicationMode }: { definition: AgentDefinition; version: AgentDefinition["versions"][number]; busy: boolean; mutate: Props["mutate"]; publicationMode: NonNullable<Props["publicationMode"]> }) {
  const publications: Array<{ environment: AgentEnvironment }> = definition.publications.filter((item) => item.configurationVersionId === version.id);
  const activeVersion = (environment: AgentEnvironment) => {
    const publication = definition.publications.find((item) => item.environment === environment);
    return definition.versions.find((item) => item.id === publication?.configurationVersionId);
  };
  const actionLabel = (environment: AgentEnvironment) => {
    const current = activeVersion(environment);
    const name = environment === "gray" ? "Gray" : "Production";
    return current && version.version < current.version ? `回滚 ${name} 至此版本` : `发布 ${name}`;
  };
  const publish = (environment: AgentEnvironment) => {
    const label = actionLabel(environment);
    if (environment === "production" || label.startsWith("回滚")) {
      if (!window.confirm(`确认${label}？该操作会切换后续新 Agent Run 使用的配置，不改变正在运行或已经完成的记录。`)) return;
    }
    void mutate(() => adminAgentGovernanceApi.publishRoleVersion(version.id, environment));
  };
  return <div className="agent-version-row"><div><strong>v{version.version}</strong><span className={`agent-status agent-status--${version.status}`}>{statusLabel(version.status)}</span>{publications.map((item) => <span className={`agent-environment agent-environment--${item.environment}`} key={item.environment}>当前 {item.environment === "gray" ? "Gray" : "Production"}</span>)}</div><div className="agent-inline-actions">
    {version.status === "draft" ? <button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.transitionRoleVersion(version.id, "review"))}>送审</button> : null}
    {version.status === "review" ? <><button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.transitionRoleVersion(version.id, "draft"))}>退回</button><button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.transitionRoleVersion(version.id, "approved"))}><Check />批准</button></> : null}
    {publicationMode === "manage" && version.status === "approved" && !publications.some((item) => item.environment === "gray") ? <button type="button" disabled={busy} onClick={() => publish("gray")}>{actionLabel("gray")}</button> : null}
    {publicationMode === "manage" && version.status === "approved" && !publications.some((item) => item.environment === "production") ? <button type="button" disabled={busy} onClick={() => publish("production")}>{actionLabel("production")}</button> : null}
  </div></div>;
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="agent-field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function display(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (value === null || value === "") return "-";
  return String(value);
}

function statusLabel(value: AgentVersionStatus) {
  return ({ draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役" })[value];
}
