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

interface Props {
  value: AgentRoleWorkspaceData;
  busy: boolean;
  mutate: (work: () => Promise<unknown>) => Promise<void>;
}

export function AdminAgentRoleConfigurationEditor({ value, busy, mutate }: Props) {
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(value.definitions[0]?.id || "");
  const definition = value.definitions.find((item) => item.id === selectedDefinitionId) || value.definitions[0];
  const [sourceVersionId, setSourceVersionId] = useState(definition?.versions[0]?.id || "");
  const sourceVersion = definition?.versions.find((item) => item.id === sourceVersionId) || definition?.versions[0];
  const [draft, setDraft] = useState<AgentRuntimeConfiguration>(() => normalizeAgentRuntimeConfiguration(sourceVersion?.configuration));

  useEffect(() => {
    if (!definition) return;
    const next = definition.versions[0];
    setSourceVersionId(next?.id || "");
    setDraft(normalizeAgentRuntimeConfiguration(next?.configuration));
  }, [definition?.id]);
  useEffect(() => {
    setDraft(normalizeAgentRuntimeConfiguration(sourceVersion?.configuration));
  }, [sourceVersion?.id]);

  const diff = useMemo(() => diffAgentRuntimeConfiguration(normalizeAgentRuntimeConfiguration(sourceVersion?.configuration), draft), [sourceVersion?.configuration, draft]);
  if (!definition) return <div className="agent-empty">尚未创建 Agent 定义</div>;

  return <div className="agent-split-layout agent-config-editor">
    <div className="agent-rail" role="tablist" aria-label="Agent 角色">
      {value.definitions.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === definition.id} className={item.id === definition.id ? "active" : ""} onClick={() => setSelectedDefinitionId(item.id)}>
        <span><strong>{item.name}</strong><small>{item.role} · {item.agentKey}</small></span>
      </button>)}
    </div>
    <div className="agent-inspector agent-config-editor__inspector">
      <header className="agent-config-editor__header"><div><strong>{definition.name}</strong><span>{definition.description || definition.agentKey}</span></div><span className={`agent-status agent-status--${definition.enabled ? "enabled" : "disabled"}`}>{definition.enabled ? "启用" : "停用"}</span></header>
      <div className="agent-config-editor__version-bar">
        <label><span>基准版本</span><select value={sourceVersion?.id || ""} onChange={(event) => setSourceVersionId(event.target.value)}>{definition.versions.map((version) => <option value={version.id} key={version.id}>v{version.version} · {statusLabel(version.status)}</option>)}</select></label>
        <button type="button" className="ghost-action" disabled={busy || !sourceVersion} onClick={() => sourceVersion && void mutate(() => adminAgentGovernanceApi.cloneRoleVersion(sourceVersion.id))}><Copy />复制为草稿</button>
      </div>

      <section className="agent-config-section">
        <h3>角色与提示词</h3>
        <label className="agent-field"><span>角色说明</span><input value={draft.roleDescription} onChange={(event) => setDraft({ ...draft, roleDescription: event.target.value })} /></label>
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
        <h3>知识检索</h3>
        <label className="agent-field"><span>受众</span><select value={draft.knowledge.audience} onChange={(event) => setDraft({ ...draft, knowledge: { ...draft.knowledge, audience: event.target.value === "public" ? "public" : "internal" } })}><option value="public">公开</option><option value="internal">内部</option></select></label>
        <NumberField label="Top K" value={draft.knowledge.topK} min={1} max={20} onChange={(topK) => setDraft({ ...draft, knowledge: { ...draft.knowledge, topK } })} />
        <NumberField label="检索 Token 预算" value={draft.knowledge.tokenBudget} min={128} max={32000} onChange={(tokenBudget) => setDraft({ ...draft, knowledge: { ...draft.knowledge, tokenBudget } })} />
        <div className="agent-config-checklist"><span>知识集合</span>{value.knowledge.filter((collection) => collection.audience === draft.knowledge.audience).map((collection) => <label key={collection.id}><input type="checkbox" checked={draft.knowledge.collectionAllowlist.includes(collection.collectionKey)} onChange={() => setDraft({ ...draft, knowledge: { ...draft.knowledge, collectionAllowlist: toggle(draft.knowledge.collectionAllowlist, collection.collectionKey) } })} /><span>{collection.name}</span><code>{collection.collectionKey}</code></label>)}</div>
      </section>

      <section className="agent-config-section">
        <h3>工具权限</h3>
        <div className="agent-config-checklist agent-config-checklist--tools">{value.tools.catalog.filter((tool) => tool.roles.includes(definition.role)).map((tool) => <label key={tool.name}><input type="checkbox" checked={draft.toolAllowlist.includes(tool.name)} onChange={() => setDraft({ ...draft, toolAllowlist: toggle(draft.toolAllowlist, tool.name) })} /><span>{tool.label}</span><code>{tool.name}</code></label>)}</div>
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

      <div className="agent-config-editor__actions"><button type="button" className="primary-action" disabled={busy || diff.length === 0} onClick={() => void mutate(() => adminAgentGovernanceApi.createRoleVersion(definition.id, normalizeAgentRuntimeConfiguration(draft)))}><Save />保存为新草稿</button></div>
      <div className="agent-version-list">{definition.versions.map((version) => <RoleVersionRow key={version.id} definition={definition} version={version} busy={busy} mutate={mutate} />)}</div>
    </div>
  </div>;
}

function RoleVersionRow({ definition, version, busy, mutate }: { definition: AgentDefinition; version: AgentDefinition["versions"][number]; busy: boolean; mutate: Props["mutate"] }) {
  const publications: Array<{ environment: AgentEnvironment }> = definition.publications.filter((item) => item.configurationVersionId === version.id);
  return <div className="agent-version-row"><div><strong>v{version.version}</strong><span className={`agent-status agent-status--${version.status}`}>{statusLabel(version.status)}</span>{publications.map((item) => <span key={item.environment}>{item.environment}</span>)}</div><div className="agent-inline-actions">
    {version.status === "draft" ? <button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.transitionRoleVersion(version.id, "review"))}>送审</button> : null}
    {version.status === "review" ? <><button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.transitionRoleVersion(version.id, "draft"))}>退回</button><button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.transitionRoleVersion(version.id, "approved"))}><Check />批准</button></> : null}
    {version.status === "approved" ? <><button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.publishRoleVersion(version.id, "gray"))}>发布 Gray</button><button type="button" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.publishRoleVersion(version.id, "production"))}>发布 Production</button></> : null}
  </div></div>;
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="agent-field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort();
}

function display(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (value === null || value === "") return "-";
  return String(value);
}

function statusLabel(value: AgentVersionStatus) {
  return ({ draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役" })[value];
}
