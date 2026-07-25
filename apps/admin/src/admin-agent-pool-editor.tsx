import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Save, Trash2 } from "lucide-react";

import type { ModelRecord } from "./admin-types";
import { adminAgentGovernanceApi, type AgentEnvironment, type AgentVersionStatus, type LlmRouteEntry, type LlmRoutePool } from "./admin-agent-governance-api";
import { routePurpose } from "./admin-agent-governance-purpose";

interface Props {
  pools: LlmRoutePool[];
  models: ModelRecord[];
  busy: boolean;
  mutate: (work: () => Promise<unknown>) => Promise<void>;
  publicationMode?: "manage" | "read-only";
  onDirtyChange?: (dirty: boolean) => void;
}

interface EntryDraft {
  modelId: string;
  providerId: string;
  capabilityTags: string[];
  priority: number;
  weight: number;
  estimatedCost: number;
  enabled: boolean;
}

interface PoolDraft {
  failureThreshold: number;
  cooldownMs: number;
  entries: EntryDraft[];
}

export function AdminAgentPoolEditor({ pools, models, busy, mutate, publicationMode = "manage", onDirtyChange }: Props) {
  const [poolId, setPoolId] = useState(pools[0]?.id || "");
  const pool = pools.find((item) => item.id === poolId) || pools[0];
  const [versionId, setVersionId] = useState(pool?.versions[0]?.id || "");
  const version = pool?.versions.find((item) => item.id === versionId) || pool?.versions[0];
  const [draft, setDraft] = useState<PoolDraft>(() => poolDraft(version));
  const [simulation, setSimulation] = useState("");

  useEffect(() => {
    const next = pool?.versions[0];
    setVersionId(next?.id || "");
    setDraft(poolDraft(next));
    setSimulation("");
  }, [pool?.id]);
  useEffect(() => setDraft(poolDraft(version)), [version?.id]);

  const source = useMemo(() => poolDraft(version), [version]);
  const changed = JSON.stringify(source) !== JSON.stringify(draft);
  useEffect(() => onDirtyChange?.(changed), [changed, onDirtyChange]);
  if (!pool) return <div className="agent-empty">尚未创建 LLM 路由池</div>;

  const addEntry = () => {
    const model = models.find((candidate) => !draft.entries.some((entry) => entry.modelId === candidate.id));
    if (!model) return;
    setDraft({ ...draft, entries: [...draft.entries, fromModel(model, draft.entries.length + 1)] });
  };

  return <div className="agent-split-layout agent-config-editor">
    <div className="agent-rail" role="tablist" aria-label="LLM 路由池">{pools.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === pool.id} className={item.id === pool.id ? "active" : ""} onClick={() => setPoolId(item.id)}><span><strong>{routePurpose(item.role, item.scenario, item.poolKey)?.label || item.name}</strong><small>{item.name}</small></span></button>)}</div>
    <div className="agent-inspector agent-config-editor__inspector">
      <header className="agent-config-editor__header"><div><strong>{routePurpose(pool.role, pool.scenario, pool.poolKey)?.label || pool.name}</strong><span>{pool.name} · 仅影响发布后开始的新 Run</span></div><span className={`agent-status agent-status--${pool.enabled ? "enabled" : "disabled"}`}>{pool.enabled ? "启用" : "停用"}</span></header>
      <div className="agent-config-editor__version-bar"><label><span>基准版本</span><select value={version?.id || ""} onChange={(event) => setVersionId(event.target.value)}>{pool.versions.map((item) => <option key={item.id} value={item.id}>v{item.version} · {statusLabel(item.status)}</option>)}</select></label><button type="button" className="ghost-action" disabled={busy || !version} onClick={() => setDraft(poolDraft(version))}>恢复基准</button></div>

      <section className="agent-config-section agent-config-grid"><h3>路由策略</h3>
        <NumberField label="技术失败阈值" value={draft.failureThreshold} min={1} max={20} onChange={(failureThreshold) => setDraft({ ...draft, failureThreshold })} />
        <NumberField label="熔断冷却 (ms)" value={draft.cooldownMs} min={1000} max={3600000} onChange={(cooldownMs) => setDraft({ ...draft, cooldownMs })} />
      </section>

      <section className="agent-config-section"><div className="agent-action-head"><h3>候选模型</h3><button type="button" className="ghost-action" disabled={busy || draft.entries.length >= models.length} onClick={addEntry}><Plus />添加候选</button></div>
        <div className="agent-route-entry-editor">{draft.entries.map((entry, index) => {
          const selected = models.find((model) => model.id === entry.modelId);
          return <div key={`${entry.modelId}-${index}`} className="agent-route-entry-editor__row">
            <label className="agent-field"><span>模型</span><select value={entry.modelId} onChange={(event) => { const model = models.find((item) => item.id === event.target.value); if (model) updateEntry(index, fromModel(model, entry.priority), draft, setDraft); }}>{models.map((model) => <option key={model.id} value={model.id} disabled={draft.entries.some((item, itemIndex) => itemIndex !== index && item.modelId === model.id)}>{model.displayName} · {model.providerId}</option>)}</select></label>
            <NumberField label="优先级" value={entry.priority} min={0} max={10000} onChange={(priority) => updateEntry(index, { ...entry, priority }, draft, setDraft)} />
            <NumberField label="权重" value={entry.weight} min={1} max={1000} onChange={(weight) => updateEntry(index, { ...entry, weight }, draft, setDraft)} />
            <NumberField label="估算成本" value={entry.estimatedCost} min={0} max={1000000} step={0.0001} onChange={(estimatedCost) => updateEntry(index, { ...entry, estimatedCost }, draft, setDraft)} />
            <label className="agent-toggle-field"><input type="checkbox" checked={entry.enabled} onChange={(event) => updateEntry(index, { ...entry, enabled: event.target.checked }, draft, setDraft)} /><span>启用候选</span></label>
            <button type="button" className="icon-button" title="移除候选" disabled={draft.entries.length <= 1} onClick={() => setDraft({ ...draft, entries: draft.entries.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></button>
            <div className="agent-route-entry-editor__facts"><span>能力</span>{(selected?.capabilityTags || []).map((tag) => <label key={tag}><input type="checkbox" checked={entry.capabilityTags.includes(tag)} onChange={() => updateEntry(index, { ...entry, capabilityTags: toggle(entry.capabilityTags, tag) }, draft, setDraft)} /><code>{tag}</code></label>)}</div>
          </div>;
        })}</div>
      </section>

      <div className="agent-config-editor__actions"><span>{changed ? `${draft.entries.length} 个候选待保存` : "与基准版本一致"}</span><button type="button" className="primary-action" disabled={busy || !changed || draft.entries.length === 0} onClick={() => void mutate(() => adminAgentGovernanceApi.createPoolVersion(pool.id, { policy: { failureThreshold: draft.failureThreshold, cooldownMs: draft.cooldownMs }, entries: draft.entries }))}><Save />保存为新草稿</button></div>
      {version ? <div className="agent-simulator"><strong>路由模拟</strong><button type="button" className="ghost-action" disabled={busy} onClick={async () => { setSimulation(""); try { const result = await adminAgentGovernanceApi.simulatePool({ versionId: version.id, role: pool.role, scenario: pool.scenario, requiredCapabilityTags: [], decisionKey: `admin-preview-${Date.now()}` }); setSimulation(`${result.decision.selectedEntryId} · ${result.decision.reason}`); } catch (error) { setSimulation(error instanceof Error ? error.message : String(error)); } }}>运行模拟</button>{simulation ? <p>{simulation}</p> : null}</div> : null}
      <section className="agent-version-history"><header><strong>版本历史</strong><span>审核、发布与回滚在这里单独管理</span></header><div className="agent-version-list">{pool.versions.map((item) => <PoolVersionRow key={item.id} pool={pool} version={item} busy={busy} mutate={mutate} publicationMode={publicationMode} />)}</div></section>
    </div>
  </div>;
}

function PoolVersionRow({ pool, version, busy, mutate, publicationMode }: { pool: LlmRoutePool; version: LlmRoutePool["versions"][number]; busy: boolean; mutate: Props["mutate"]; publicationMode: NonNullable<Props["publicationMode"]> }) {
  const activeVersion = (environment: AgentEnvironment) => pool.versions.find((item) => item.publications.some((publication) => publication.environment === environment));
  const actionLabel = (environment: AgentEnvironment) => {
    const current = activeVersion(environment);
    const name = environment === "gray" ? "Gray" : "Production";
    return current && version.version < current.version ? `回滚 ${name} 至此版本` : `发布 ${name}`;
  };
  const publish = async (environment: AgentEnvironment) => {
    const label = actionLabel(environment);
    if ((environment === "production" || label.startsWith("回滚")) && !window.confirm(`确认${label}？该操作会切换后续新 Run 使用的路由。`)) return;
    await mutate(() => adminAgentGovernanceApi.publishPoolVersion(version.id, environment));
  };
  return <div className="agent-version-row"><div><strong>v{version.version} · {version.entries.length} 个候选</strong><span className={`agent-status agent-status--${version.status}`}>{statusLabel(version.status)}</span>{version.publications.map((item) => <span className={`agent-environment agent-environment--${item.environment}`} key={item.environment}>当前 {item.environment === "gray" ? "Gray" : "Production"}</span>)}</div><VersionActions status={version.status} busy={busy} published={version.publications.map((item) => item.environment)} onTransition={(status) => mutate(() => adminAgentGovernanceApi.transitionPoolVersion(version.id, status))} onPublish={publish} actionLabel={actionLabel} publicationMode={publicationMode} /></div>;
}

function VersionActions({ status, busy, published, onTransition, onPublish, actionLabel, publicationMode }: { status: AgentVersionStatus; busy: boolean; published: AgentEnvironment[]; onTransition: (status: AgentVersionStatus) => Promise<void>; onPublish: (environment: AgentEnvironment) => Promise<void>; actionLabel: (environment: AgentEnvironment) => string; publicationMode: NonNullable<Props["publicationMode"]> }) {
  return <div className="agent-inline-actions">{status === "draft" ? <button type="button" disabled={busy} onClick={() => void onTransition("review")}>送审</button> : null}{status === "review" ? <><button type="button" disabled={busy} onClick={() => void onTransition("draft")}>退回</button><button type="button" disabled={busy} onClick={() => void onTransition("approved")}><Check />批准</button></> : null}{publicationMode === "manage" && status === "approved" && !published.includes("gray") ? <button type="button" disabled={busy} onClick={() => void onPublish("gray")}>{actionLabel("gray")}</button> : null}{publicationMode === "manage" && status === "approved" && !published.includes("production") ? <button type="button" disabled={busy} onClick={() => void onPublish("production")}>{actionLabel("production")}</button> : null}</div>;
}

function poolDraft(version: LlmRoutePool["versions"][number] | undefined): PoolDraft {
  return {
    failureThreshold: integer(version?.policy.failureThreshold, 3),
    cooldownMs: integer(version?.policy.cooldownMs, 60000),
    entries: (version?.entries || []).map(entryDraft),
  };
}

function entryDraft(entry: LlmRouteEntry): EntryDraft {
  return { modelId: entry.modelId, providerId: entry.providerId, capabilityTags: entry.capabilityTags, priority: entry.priority, weight: entry.weight, estimatedCost: entry.estimatedCost, enabled: entry.enabled };
}

function fromModel(model: ModelRecord, priority: number): EntryDraft {
  return { modelId: model.id, providerId: model.providerId, capabilityTags: [...(model.capabilityTags || [])], priority, weight: 1, estimatedCost: 0, enabled: true };
}

function updateEntry(index: number, entry: EntryDraft, draft: PoolDraft, setDraft: (value: PoolDraft) => void) {
  setDraft({ ...draft, entries: draft.entries.map((item, itemIndex) => itemIndex === index ? entry : item) });
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort();
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="agent-field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function integer(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function statusLabel(value: AgentVersionStatus) {
  return ({ draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役" })[value];
}
