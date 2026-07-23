import { useEffect, useState } from "react";
import { Check, FilePlus2, Save } from "lucide-react";
import { AssistantMarkdown } from "@xinghuan/ui";

import { adminAgentGovernanceApi, type AgentEnvironment, type AgentVersionStatus, type KnowledgeCollection } from "./admin-agent-governance-api";

interface Props {
  value: KnowledgeCollection[];
  busy: boolean;
  mutate: (work: () => Promise<unknown>) => Promise<void>;
}

interface DocumentDraft {
  collectionId: string;
  sourceDocumentId: string;
  documentKey: string;
  title: string;
  body: string;
  sourceType: "maintained" | "workflow-template";
  templateKey: string;
  templateRevision: number;
  templateHash: string;
}

export function AdminAgentKnowledgeEditor({ value, busy, mutate }: Props) {
  const [collectionForm, setCollectionForm] = useState({ collectionKey: "", name: "", description: "", audience: "public" });
  const [selectedCollectionId, setSelectedCollectionId] = useState(value[0]?.id || "");
  const collection = value.find((item) => item.id === selectedCollectionId) || value[0];
  const [draft, setDraft] = useState<DocumentDraft>(() => emptyDraft(collection?.id || ""));

  useEffect(() => {
    if (!collection) return;
    const source = collection.documents[0];
    setDraft(source ? fromDocument(collection.id, source) : emptyDraft(collection.id));
  }, [collection?.id]);

  const source = collection?.documents.find((document) => document.id === draft.sourceDocumentId);
  const save = () => {
    if (!collection) return Promise.resolve();
    const sourceSnapshot = draft.sourceType === "workflow-template"
      ? { type: "workflow-template", templateKey: draft.templateKey, revision: draft.templateRevision, hash: draft.templateHash }
      : { type: "maintained" };
    return adminAgentGovernanceApi.createKnowledgeDocument(collection.id, { documentKey: draft.documentKey, title: draft.title, body: draft.body, source: sourceSnapshot });
  };

  return <div className="agent-governance-stack">
    <form className="agent-inline-form" onSubmit={(event) => { event.preventDefault(); void mutate(() => adminAgentGovernanceApi.createKnowledgeCollection(collectionForm)); }}>
      <label className="agent-field"><span>集合 Key</span><input value={collectionForm.collectionKey} onChange={(event) => setCollectionForm({ ...collectionForm, collectionKey: event.target.value })} /></label>
      <label className="agent-field"><span>名称</span><input value={collectionForm.name} onChange={(event) => setCollectionForm({ ...collectionForm, name: event.target.value })} /></label>
      <label className="agent-field"><span>说明</span><input value={collectionForm.description} onChange={(event) => setCollectionForm({ ...collectionForm, description: event.target.value })} /></label>
      <label className="agent-field"><span>受众</span><select value={collectionForm.audience} onChange={(event) => setCollectionForm({ ...collectionForm, audience: event.target.value })}><option value="public">公开</option><option value="internal">内部</option></select></label>
      <button type="submit" className="primary-action" disabled={busy || !collectionForm.collectionKey.trim() || !collectionForm.name.trim()}><FilePlus2 />创建集合</button>
    </form>

    <div className="agent-split-layout agent-config-editor">
      <div className="agent-rail" role="tablist" aria-label="知识集合">{value.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === collection?.id} className={item.id === collection?.id ? "active" : ""} onClick={() => setSelectedCollectionId(item.id)}><span><strong>{item.name}</strong><small>{item.audience} · {item.documents.length} 个版本</small></span></button>)}</div>
      <div className="agent-inspector agent-config-editor__inspector">{collection ? <>
        <header className="agent-config-editor__header"><div><strong>{collection.name}</strong><span>{collection.collectionKey} · revision {collection.revision}</span></div><span className={`agent-status agent-status--${collection.audience}`}>{collection.audience === "public" ? "公开" : "内部"}</span></header>
        <div className="agent-config-editor__version-bar"><label><span>基准文档</span><select value={draft.sourceDocumentId} onChange={(event) => { const next = collection.documents.find((item) => item.id === event.target.value); setDraft(next ? fromDocument(collection.id, next) : emptyDraft(collection.id)); }}><option value="">新文档</option>{collection.documents.map((item) => <option value={item.id} key={item.id}>{item.documentKey} · v{item.version} · {statusLabel(item.status)}</option>)}</select></label><button type="button" className="ghost-action" onClick={() => setDraft(emptyDraft(collection.id))}>新建空白文档</button></div>

        <div className="agent-knowledge-editor">
          <section className="agent-config-section">
            <h3>{source ? `从 ${source.documentKey}@${source.version} 创建新草稿` : "新文档草稿"}</h3>
            <label className="agent-field"><span>文档 Key</span><input value={draft.documentKey} onChange={(event) => setDraft({ ...draft, documentKey: event.target.value })} /></label>
            <label className="agent-field"><span>标题</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="agent-field"><span>Markdown 正文</span><textarea rows={18} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
            <label className="agent-field"><span>来源类型</span><select value={draft.sourceType} onChange={(event) => setDraft({ ...draft, sourceType: event.target.value === "workflow-template" ? "workflow-template" : "maintained" })}><option value="maintained">维护文档</option><option value="workflow-template">工作流模板</option></select></label>
            {draft.sourceType === "workflow-template" ? <div className="agent-config-grid"><label className="agent-field"><span>Template Key</span><input value={draft.templateKey} onChange={(event) => setDraft({ ...draft, templateKey: event.target.value })} /></label><label className="agent-field"><span>Revision</span><input type="number" min="1" value={draft.templateRevision} onChange={(event) => setDraft({ ...draft, templateRevision: Number(event.target.value) })} /></label><label className="agent-field"><span>Content Hash</span><input value={draft.templateHash} onChange={(event) => setDraft({ ...draft, templateHash: event.target.value })} /></label></div> : null}
            <button type="button" className="primary-action" disabled={busy || !draft.documentKey.trim() || !draft.title.trim() || !draft.body.trim() || (draft.sourceType === "workflow-template" && !draft.templateKey.trim())} onClick={() => void mutate(save)}><Save />保存为新草稿</button>
          </section>
          <section className="agent-config-section agent-knowledge-editor__preview"><h3>安全预览</h3><AssistantMarkdown markdown={draft.body || "_暂无正文_"} /></section>
        </div>

        <div className="agent-version-list">{collection.documents.map((document) => <KnowledgeVersionRow key={document.id} document={document} busy={busy} mutate={mutate} />)}</div>
      </> : <div className="agent-empty">尚未创建知识集合</div>}</div>
    </div>
  </div>;
}

function KnowledgeVersionRow({ document, busy, mutate }: { document: KnowledgeCollection["documents"][number]; busy: boolean; mutate: Props["mutate"] }) {
  return <div className="agent-version-row"><div><strong>{document.title} · v{document.version}</strong><code>{document.documentKey}</code><span className={`agent-status agent-status--${document.status}`}>{statusLabel(document.status)}</span>{document.publications.map((item) => <span className={`agent-environment agent-environment--${item.environment}`} key={item.environment}>{item.environment === "gray" ? "Gray" : "Production"}</span>)}</div><VersionActions status={document.status} busy={busy} onTransition={(status) => mutate(() => adminAgentGovernanceApi.transitionKnowledgeDocument(document.id, status))} onPublish={(environment) => mutate(() => adminAgentGovernanceApi.publishKnowledgeDocument(document.id, environment))} /></div>;
}

function VersionActions({ status, busy, onTransition, onPublish }: { status: AgentVersionStatus; busy: boolean; onTransition: (status: AgentVersionStatus) => Promise<void>; onPublish: (environment: AgentEnvironment) => Promise<void> }) {
  return <div className="agent-inline-actions">{status === "draft" ? <button type="button" disabled={busy} onClick={() => void onTransition("review")}>送审</button> : null}{status === "review" ? <><button type="button" disabled={busy} onClick={() => void onTransition("draft")}>退回</button><button type="button" disabled={busy} onClick={() => void onTransition("approved")}><Check />批准</button></> : null}{status === "approved" ? <><button type="button" disabled={busy} onClick={() => void onPublish("gray")}>发布 Gray</button><button type="button" disabled={busy} onClick={() => void onPublish("production")}>发布 Production</button></> : null}</div>;
}

function emptyDraft(collectionId: string): DocumentDraft {
  return { collectionId, sourceDocumentId: "", documentKey: "", title: "", body: "", sourceType: "maintained", templateKey: "", templateRevision: 1, templateHash: "" };
}

function fromDocument(collectionId: string, document: KnowledgeCollection["documents"][number]): DocumentDraft {
  const workflow = document.source.type === "workflow-template";
  return {
    collectionId,
    sourceDocumentId: document.id,
    documentKey: document.documentKey,
    title: document.title,
    body: document.body,
    sourceType: workflow ? "workflow-template" : "maintained",
    templateKey: workflow ? String(document.source.templateKey || "") : "",
    templateRevision: workflow ? Number(document.source.revision || 1) : 1,
    templateHash: workflow ? String(document.source.hash || "") : "",
  };
}

function statusLabel(value: AgentVersionStatus) {
  return ({ draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役" })[value];
}
