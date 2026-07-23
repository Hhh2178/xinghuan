import { useEffect, useState } from "react";
import { Check, Save } from "lucide-react";

import { adminAgentGovernanceApi, type AgentEnvironment, type AgentVersionStatus, type QualityProfile } from "./admin-agent-governance-api";

interface Props {
  value: QualityProfile[];
  busy: boolean;
  mutate: (work: () => Promise<unknown>) => Promise<void>;
}

interface Draft {
  profileKey: string;
  mediaKind: "image" | "video";
  minimumOverallScore: number;
  minimumConfidence: number;
  instructions: string;
  weights: Record<string, number>;
}

const imageDimensions = ["technical", "semantic", "aesthetic", "safety"];
const videoDimensions = ["technical", "semantic", "aesthetic", "temporalCoherence", "motionQuality", "keyframeConsistency"];

export function AdminAgentQualityEditor({ value, busy, mutate }: Props) {
  const keys = [...new Set(value.map((profile) => profile.profileKey))];
  const [profileKey, setProfileKey] = useState(keys[0] || "image-default");
  const versions = value.filter((profile) => profile.profileKey === profileKey);
  const [versionId, setVersionId] = useState(versions[0]?.id || "");
  const source = versions.find((profile) => profile.id === versionId) || versions[0];
  const [draft, setDraft] = useState<Draft>(() => qualityDraft(source, profileKey));

  useEffect(() => {
    const next = value.find((profile) => profile.profileKey === profileKey);
    setVersionId(next?.id || "");
    setDraft(qualityDraft(next, profileKey));
  }, [profileKey, value]);
  useEffect(() => setDraft(qualityDraft(source, profileKey)), [source?.id]);

  const dimensions = draft.mediaKind === "video" ? videoDimensions : imageDimensions;
  return <div className="agent-split-layout agent-config-editor">
    <div className="agent-rail">{keys.map((key) => <button key={key} type="button" className={key === profileKey ? "active" : ""} onClick={() => setProfileKey(key)}><span><strong>{key}</strong><small>{value.filter((profile) => profile.profileKey === key).length} 个版本</small></span></button>)}<button type="button" className={!keys.includes(profileKey) ? "active" : ""} onClick={() => { setProfileKey("new-profile"); setDraft(qualityDraft(undefined, "new-profile")); }}><span><strong>新质量配置</strong><small>创建 v1 草稿</small></span></button></div>
    <div className="agent-inspector agent-config-editor__inspector">
      <div className="agent-config-editor__version-bar"><label><span>基准版本</span><select value={source?.id || ""} onChange={(event) => setVersionId(event.target.value)}><option value="">新配置</option>{versions.map((profile) => <option key={profile.id} value={profile.id}>v{profile.version} · {statusLabel(profile.status)}</option>)}</select></label></div>
      <section className="agent-config-section agent-config-grid"><h3>评分边界</h3><label className="agent-field"><span>Profile Key</span><input value={draft.profileKey} onChange={(event) => setDraft({ ...draft, profileKey: event.target.value })} /></label><label className="agent-field"><span>媒体</span><select value={draft.mediaKind} onChange={(event) => { const mediaKind = event.target.value === "video" ? "video" : "image"; setDraft({ ...draft, mediaKind, weights: defaultWeights(mediaKind) }); }}><option value="image">图片</option><option value="video">视频</option></select></label><NumberField label="最低总分" value={draft.minimumOverallScore} min={0} max={100} onChange={(minimumOverallScore) => setDraft({ ...draft, minimumOverallScore })} /><NumberField label="最低置信度" value={draft.minimumConfidence} min={0} max={1} step={0.05} onChange={(minimumConfidence) => setDraft({ ...draft, minimumConfidence })} /></section>
      <section className="agent-config-section"><h3>评分维度权重</h3><div className="agent-quality-weight-grid">{dimensions.map((dimension) => <NumberField key={dimension} label={dimension} value={draft.weights[dimension] || 0} min={0} max={1} step={0.05} onChange={(weight) => setDraft({ ...draft, weights: { ...draft.weights, [dimension]: weight } })} />)}</div><span className="agent-config-empty">权重合计 {Object.values(draft.weights).reduce((sum, weight) => sum + Number(weight || 0), 0).toFixed(2)}</span></section>
      <section className="agent-config-section"><h3>评估指令</h3><label className="agent-field"><span>Instructions</span><textarea rows={8} value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} /></label></section>
      <div className="agent-config-editor__actions"><button type="button" className="primary-action" disabled={busy || !draft.profileKey.trim()} onClick={() => void mutate(() => adminAgentGovernanceApi.createQualityProfile(draft))}><Save />保存为新草稿</button></div>
      <div className="agent-version-list">{versions.map((profile) => <QualityVersionRow key={profile.id} profile={profile} busy={busy} mutate={mutate} />)}</div>
    </div>
  </div>;
}

function QualityVersionRow({ profile, busy, mutate }: { profile: QualityProfile; busy: boolean; mutate: Props["mutate"] }) {
  return <div className="agent-version-row"><div><strong>v{profile.version} · {profile.mediaKind}</strong><span className={`agent-status agent-status--${profile.status}`}>{statusLabel(profile.status)}</span>{profile.publications.map((item) => <span className={`agent-environment agent-environment--${item.environment}`} key={item.environment}>{item.environment === "gray" ? "Gray" : "Production"}</span>)}</div><VersionActions status={profile.status} busy={busy} onTransition={(status) => mutate(() => adminAgentGovernanceApi.transitionQualityProfile(profile.id, status))} onPublish={(environment) => mutate(() => adminAgentGovernanceApi.publishQualityProfile(profile.id, environment))} /></div>;
}

function VersionActions({ status, busy, onTransition, onPublish }: { status: AgentVersionStatus; busy: boolean; onTransition: (status: AgentVersionStatus) => Promise<void>; onPublish: (environment: AgentEnvironment) => Promise<void> }) {
  return <div className="agent-inline-actions">{status === "draft" ? <button type="button" disabled={busy} onClick={() => void onTransition("review")}>送审</button> : null}{status === "review" ? <><button type="button" disabled={busy} onClick={() => void onTransition("draft")}>退回</button><button type="button" disabled={busy} onClick={() => void onTransition("approved")}><Check />批准</button></> : null}{status === "approved" ? <><button type="button" disabled={busy} onClick={() => void onPublish("gray")}>发布 Gray</button><button type="button" disabled={busy} onClick={() => void onPublish("production")}>发布 Production</button></> : null}</div>;
}

function qualityDraft(profile: QualityProfile | undefined, profileKey: string): Draft {
  return profile ? { profileKey: profile.profileKey, mediaKind: profile.mediaKind, minimumOverallScore: profile.minimumOverallScore, minimumConfidence: profile.minimumConfidence, instructions: profile.instructions, weights: { ...profile.weights } } : { profileKey, mediaKind: "image", minimumOverallScore: 75, minimumConfidence: 0.7, instructions: "", weights: defaultWeights("image") };
}

function defaultWeights(mediaKind: "image" | "video"): Record<string, number> {
  return mediaKind === "video" ? { technical: 0.2, semantic: 0.2, aesthetic: 0.15, temporalCoherence: 0.15, motionQuality: 0.15, keyframeConsistency: 0.15 } : { technical: 0.3, semantic: 0.3, aesthetic: 0.25, safety: 0.15 };
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="agent-field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function statusLabel(value: AgentVersionStatus) {
  return ({ draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役" })[value];
}
