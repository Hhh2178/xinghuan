import {
  Activity,
  ArrowLeft,
  Boxes,
  Cpu,
  FileJson2,
  FileSearch2,
  Save,
  Trash2,
  Upload,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminComfyuiApi } from "./admin-api-client";
import { AdminComfyuiWorkflowCard, type ComfyuiWorkflowEditPayload } from "./admin-comfyui-workflow-card";
import type { ComfyuiInstanceRecord, ComfyuiWorkflowDraft } from "./admin-types";

interface ComfyuiDetailProps {
  instanceId: string;
  onBack: () => void;
  activeTab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
}

export type DetailTab = "config" | "workflows" | "logs";

const DETAIL_TABS: Array<{
  id: DetailTab;
  label: string;
  hint: string;
  icon: typeof Cpu;
}> = [
  { id: "config", label: "基本配置", hint: "实例地址、并发与连接标签", icon: Cpu },
  { id: "workflows", label: "工作流治理", hint: "上传后解析输入输出映射", icon: Workflow },
  { id: "logs", label: "执行日志 Beta", hint: "后续补齐运行记录与耗时", icon: Activity },
];

function splitCapabilities(text: string) {
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value?: number) {
  if (!value) return "未记录";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  } catch {
    return new Date(value).toLocaleString();
  }
}

function healthCopy(instance: ComfyuiInstanceRecord | null) {
  if (!instance) return { label: "待创建", tone: "draft" as const };
  if (instance.health === "online") return { label: "在线", tone: "online" as const };
  if (instance.health === "degraded") return { label: "降级", tone: "degraded" as const };
  if (instance.health === "offline") return { label: "离线", tone: "offline" as const };
  return { label: "未知", tone: "draft" as const };
}

function baseUrlSourceText(value?: ComfyuiInstanceRecord["baseUrlSource"]) {
  return value === "connector" ? "跟随 connector" : "手工固定";
}

export function AdminComfyuiDetail({ instanceId, onBack, activeTab: controlledTab, onTabChange }: ComfyuiDetailProps) {
  const [localActiveTab, setLocalActiveTab] = useState<DetailTab>(controlledTab || "config");
  const activeTab = controlledTab || localActiveTab;
  const selectTab = (tab: DetailTab) => { setLocalActiveTab(tab); onTabChange?.(tab); };
  const [instance, setInstance] = useState<ComfyuiInstanceRecord | null>(null);
  const [availableInstances, setAvailableInstances] = useState<ComfyuiInstanceRecord[]>([]);
  const [workflows, setWorkflows] = useState<ComfyuiWorkflowDraft[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [workflowImportLabel, setWorkflowImportLabel] = useState("未选择 JSON 文件");
  const [instanceForm, setInstanceForm] = useState({
    id: "",
    name: "",
    baseUrl: "http://127.0.0.1:8188",
    tailscaleAddress: "",
    concurrency: "1",
    capabilitiesText: "image",
    note: "",
    connectorVersion: "",
  });
  const [workflowTitle, setWorkflowTitle] = useState("");
  const [workflowJsonText, setWorkflowJsonText] = useState("");
  const workflowFileRef = useRef<HTMLInputElement | null>(null);

  const selectedWorkflow = useMemo(
    () => workflows.find((item) => item.id === selectedWorkflowId) || workflows[0] || null,
    [selectedWorkflowId, workflows],
  );

  const status = healthCopy(instance);
  const publishedCount = workflows.filter((item) => item.sharedWorkflowId).length;
  const warningCount = workflows.reduce((total, item) => total + item.analysis.warnings.length, 0);

  useEffect(() => {
    if (!selectedWorkflowId) {
      if (workflows[0]) setSelectedWorkflowId(workflows[0].id);
      return;
    }
    if (!workflows.some((item) => item.id === selectedWorkflowId)) {
      setSelectedWorkflowId(workflows[0]?.id || "");
    }
  }, [selectedWorkflowId, workflows]);

  async function loadInstance() {
    setLoading(true);
    setMessage("");
    try {
      const result = await adminComfyuiApi.listInstances();
      setAvailableInstances(result.instances);
      const found = result.instances.find((item) => item.id === instanceId);
      if (found) {
        setInstance(found);
        setInstanceForm({
          id: found.id,
          name: found.name,
          baseUrl: found.baseUrl,
          tailscaleAddress: found.tailscaleAddress,
          concurrency: String(found.concurrency || 1),
          capabilitiesText: found.capabilities.join(", "),
          note: found.note || "",
          connectorVersion: found.connectorVersion || "",
        });
      } else {
        setMessage("实例不存在");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkflows() {
    if (!instanceId || instanceId === "new") return;
    setLoading(true);
    setMessage("");
    try {
      const result = await adminComfyuiApi.listWorkflows(instanceId);
      setWorkflows(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (instanceId === "new") {
      setInstance(null);
      setAvailableInstances([]);
      setWorkflows([]);
      setSelectedWorkflowId("");
      setWorkflowTitle("");
      setWorkflowJsonText("");
      setWorkflowImportLabel("未选择 JSON 文件");
      setInstanceForm({
        id: "",
        name: "",
        baseUrl: "http://127.0.0.1:8188",
        tailscaleAddress: "",
        concurrency: "1",
        capabilitiesText: "image",
        note: "",
        connectorVersion: "",
      });
    } else {
      void loadInstance();
      void loadWorkflows();
    }
  }, [instanceId]);

  async function saveInstance() {
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        id: instanceForm.id.trim() || undefined,
        name: instanceForm.name.trim() || "ComfyUI 实例",
        baseUrl: instanceForm.baseUrl.trim() || "http://127.0.0.1:8188",
        tailscaleAddress: instanceForm.tailscaleAddress.trim(),
        concurrency: Number(instanceForm.concurrency) || 1,
        capabilities: splitCapabilities(instanceForm.capabilitiesText),
        note: instanceForm.note.trim(),
        connectorVersion: instanceForm.connectorVersion.trim(),
      };
      const saved = payload.id
        ? await adminComfyuiApi.updateInstance(payload.id, payload)
        : await adminComfyuiApi.createInstance(payload);
      setMessage(`已保存实例：${saved.name}`);
      setInstance(saved);
      setAvailableInstances((current) => {
        const next = current.filter((item) => item.id !== saved.id);
        next.unshift(saved);
        return next;
      });
      setInstanceForm({
        id: saved.id,
        name: saved.name,
        baseUrl: saved.baseUrl,
        tailscaleAddress: saved.tailscaleAddress,
        concurrency: String(saved.concurrency),
        capabilitiesText: saved.capabilities.join(", "),
        note: saved.note || "",
        connectorVersion: saved.connectorVersion || "",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteInstance() {
    if (!instanceForm.id) return;
    if (!window.confirm(`删除实例「${instanceForm.name || instanceForm.id}」？该实例下工作流也会一并删除。`)) return;
    setLoading(true);
    setMessage("");
    try {
      await adminComfyuiApi.deleteInstance(instanceForm.id);
      setMessage("实例已删除");
      onBack();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function createWorkflowFromJson() {
    if (!instanceId || instanceId === "new") return;
    const text = workflowJsonText.trim();
    if (!text) {
      setMessage("请先粘贴或导入 ComfyUI API workflow JSON");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const workflowJson = JSON.parse(text) as Record<string, unknown>;
      const created = await adminComfyuiApi.createWorkflow(instanceId, {
        title: workflowTitle.trim() || "ComfyUI 工作流",
        workflowJson,
      });
      setWorkflowTitle("");
      setWorkflowJsonText("");
      setWorkflowImportLabel("未选择 JSON 文件");
      setSelectedWorkflowId(created.id);
      selectTab("workflows");
      setMessage(`已创建工作流：${created.title}`);
      await loadWorkflows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function importWorkflowFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setWorkflowJsonText(text);
    setWorkflowImportLabel(file.name);
    if (!workflowTitle.trim()) setWorkflowTitle(file.name.replace(/\.json$/i, ""));
  }

  async function saveWorkflow(workflowId: string, payload: ComfyuiWorkflowEditPayload) {
    if (!instanceId || instanceId === "new") return;
    const saved = await adminComfyuiApi.updateWorkflow(instanceId, workflowId, payload);
    setMessage(`已保存工作流：${saved.title}`);
    setSelectedWorkflowId(saved.id);
    await loadWorkflows();
  }

  async function pushWorkflowToShared(workflowId: string) {
    if (!instanceId || instanceId === "new") return;
    const result = await adminComfyuiApi.pushWorkflowToShared(instanceId, workflowId);
    setMessage(`已推送到共享区：${result.sharedWorkflow.title}`);
    await loadWorkflows();
  }

  async function deleteWorkflow(workflowId: string) {
    if (!instanceId || instanceId === "new") return;
    await adminComfyuiApi.deleteWorkflow(instanceId, workflowId);
    setMessage("工作流已删除");
    if (selectedWorkflowId === workflowId) {
      const fallback = workflows.find((item) => item.id !== workflowId);
      setSelectedWorkflowId(fallback?.id || "");
    }
    await loadWorkflows();
  }

  return (
    <section className="admin-comfyui-detail-page">
      <header className="admin-comfyui-detail-header">
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          返回实例池
        </button>
        <div className="admin-comfyui-detail-header__copy">
          <span className="admin-comfyui-detail-header__eyebrow">ComfyUI 实例治理</span>
          <h1>{instance?.name || "新增实例"}</h1>
          <div className="admin-comfyui-detail-header__meta">
            <span className={`admin-comfyui-health-pill admin-comfyui-health-pill--${status.tone}`}>{status.label}</span>
            <span>{instance?.baseUrl || "等待填写后端执行地址"}</span>
            <span>{instance?.reportedBaseUrl || "未收到机器本地 ComfyUI 地址"}</span>
            <span>{instance?.tailscaleAddress || "未配置 Tailscale 地址"}</span>
          </div>
        </div>
        <div className="admin-comfyui-detail-header__actions">
          <button type="button" onClick={() => void saveInstance()} disabled={loading}>
            <Save aria-hidden="true" />
            保存配置
          </button>
          {instanceForm.id ? (
            <button type="button" className="danger" onClick={() => void deleteInstance()} disabled={loading}>
              <Trash2 aria-hidden="true" />
              删除实例
            </button>
          ) : null}
        </div>
      </header>

      {message ? <div className="message-banner">{message}</div> : null}

      <section className="admin-comfyui-summary-strip">
        <article className="admin-comfyui-summary-card">
          <div className="admin-comfyui-summary-card__icon">
            <Boxes aria-hidden="true" />
          </div>
          <div>
            <strong>{workflows.length}</strong>
            <span>实例工作流草稿</span>
          </div>
        </article>
        <article className="admin-comfyui-summary-card">
          <div className="admin-comfyui-summary-card__icon">
            <Workflow aria-hidden="true" />
          </div>
          <div>
            <strong>{publishedCount}</strong>
            <span>已推送到共享区</span>
          </div>
        </article>
        <article className="admin-comfyui-summary-card">
          <div className="admin-comfyui-summary-card__icon">
            <FileSearch2 aria-hidden="true" />
          </div>
          <div>
            <strong>{warningCount}</strong>
            <span>待人工确认告警</span>
          </div>
        </article>
        <article className="admin-comfyui-summary-card">
          <div className="admin-comfyui-summary-card__icon">
            <Activity aria-hidden="true" />
          </div>
          <div>
            <strong>{formatDateTime(instance?.lastSeenAt)}</strong>
            <span>最近心跳时间</span>
          </div>
        </article>
      </section>

      <div className="admin-comfyui-detail-tabs">
        {DETAIL_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "tab-button active" : "tab-button"}
              onClick={() => selectTab(tab.id)}
              disabled={!instance && tab.id !== "config"}
            >
              <Icon aria-hidden="true" />
              <span>
                <strong>{tab.label}</strong>
                <small>{tab.hint}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="admin-comfyui-detail-content">
        {activeTab === "config" ? (
          <div className="data-panel admin-comfyui-config-panel">
            <div className="admin-comfyui-panel-head">
              <div>
                <h2>实例配置</h2>
                <p>分开维护灰度后端可执行地址与 connector 上报的机器本地 ComfyUI 地址，避免地址语义混淆。</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                <span>实例名称</span>
                <input
                  value={instanceForm.name}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="gpu-server-01"
                />
              </label>
              <label>
                <span>后端执行地址</span>
                <input
                  value={instanceForm.baseUrl}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder="http://127.0.0.1:28188"
                />
              </label>
              <label>
                <span>机器本地 ComfyUI 地址</span>
                <input
                  value={instance?.reportedBaseUrl || ""}
                  readOnly
                  disabled
                  placeholder="connector 上报后显示"
                />
              </label>
              <label>
                <span>Tailscale 地址</span>
                <input
                  value={instanceForm.tailscaleAddress}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, tailscaleAddress: event.target.value }))}
                  placeholder="100.64.0.10"
                />
              </label>
              <label>
                <span>地址来源</span>
                <input
                  value={baseUrlSourceText(instance?.baseUrlSource)}
                  readOnly
                  disabled
                />
              </label>
              <label>
                <span>并发数</span>
                <input
                  type="number"
                  min={1}
                  value={instanceForm.concurrency}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, concurrency: event.target.value }))}
                />
              </label>
              <label className="form-grid__span-2">
                <span>能力标签（逗号分隔）</span>
                <input
                  value={instanceForm.capabilitiesText}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, capabilitiesText: event.target.value }))}
                  placeholder="workflow, image.generate"
                />
              </label>
              <label className="form-grid__span-2">
                <span>备注</span>
                <textarea
                  rows={3}
                  value={instanceForm.note}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="机器说明、反向代理方式、执行地址约定、GPU 信息等"
                />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === "workflows" && instance ? (
          <div className="admin-comfyui-workflows-panel">
            <div className="data-panel admin-comfyui-create-workflow-panel">
              <div className="admin-comfyui-panel-head">
                <div>
                  <h2>创建工作流草稿</h2>
                  <p>导入 ComfyUI API workflow JSON 后，系统会自动识别输入候选、输出候选和风险告警。</p>
                </div>
              </div>
              <div className="admin-comfyui-create-workflow-panel__guide">
                <div className="admin-comfyui-create-workflow-panel__guide-icon">
                  <FileJson2 aria-hidden="true" />
                </div>
                <div>
                  <strong>上传后请继续完成解析输入输出映射。</strong>
                  <span>把字段明确区分为参数输入、上游素材口或隐藏输入，再决定哪些输出需要发布到共享区。</span>
                </div>
              </div>
              <div className="admin-comfyui-create-workflow-panel__layout">
                <div className="form-grid">
                  <label>
                    <span>工作流标题</span>
                    <input
                      value={workflowTitle}
                      onChange={(event) => setWorkflowTitle(event.target.value)}
                      placeholder="文生图 v2"
                    />
                  </label>
                  <label className="form-grid__span-2">
                    <span>工作流 JSON</span>
                    <textarea
                      value={workflowJsonText}
                      onChange={(event) => setWorkflowJsonText(event.target.value)}
                      rows={9}
                      placeholder='粘贴 ComfyUI API workflow JSON，例如本机导出的 Z-image 工作流。'
                    />
                  </label>
                </div>
                <div className="admin-comfyui-create-workflow-panel__side">
                  <div className="admin-comfyui-upload-box">
                    <div className="admin-comfyui-upload-box__copy">
                      <strong>或导入本地 JSON 文件</strong>
                      <span>{workflowImportLabel}</span>
                    </div>
                    <button type="button" onClick={() => workflowFileRef.current?.click()} disabled={loading}>
                      <Workflow aria-hidden="true" />
                      选择 JSON 文件
                    </button>
                    <input
                      ref={workflowFileRef}
                      className="admin-comfyui-upload-box__input"
                      type="file"
                      accept=".json,application/json,text/json"
                      onChange={(event) => {
                        void importWorkflowFile(event.currentTarget.files?.[0] || null);
                        event.currentTarget.value = "";
                      }}
                    />
                  </div>
                  <div className="admin-comfyui-create-workflow-panel__checklist">
                    <strong>导入后会立即进入这三个治理动作</strong>
                    <span>1. 检查系统识别出的输入和输出。</span>
                    <span>2. 调整哪些是画布参数，哪些是上游素材口。</span>
                    <span>3. 确认输出 key 和共享发布状态。</span>
                  </div>
                </div>
              </div>
              <div className="admin-comfyui-actions">
                <button type="button" onClick={() => void createWorkflowFromJson()} disabled={loading}>
                  <Upload aria-hidden="true" />
                  创建工作流草稿
                </button>
              </div>
            </div>

            <div className="admin-comfyui-governance-layout">
              <aside className="data-panel admin-comfyui-workflow-rail">
                <div className="admin-comfyui-panel-head admin-comfyui-panel-head--compact">
                  <div>
                    <h2>工作流列表</h2>
                    <p>先选中一个草稿，再在右侧治理它的输入输出映射。</p>
                  </div>
                </div>
                <div className="admin-comfyui-workflow-rail__list">
                  {workflows.map((workflow) => (
                    <button
                      key={workflow.id}
                      type="button"
                      className={selectedWorkflow?.id === workflow.id ? "admin-comfyui-workflow-rail__item active" : "admin-comfyui-workflow-rail__item"}
                      onClick={() => setSelectedWorkflowId(workflow.id)}
                    >
                      <div className="admin-comfyui-workflow-rail__item-icon">
                        <Workflow aria-hidden="true" />
                      </div>
                      <div className="admin-comfyui-workflow-rail__item-copy">
                        <strong>{workflow.title}</strong>
                        <span>{workflow.inputSchema.length} 个输入映射 · {workflow.outputSchema.length} 个输出</span>
                        <small>{workflow.analysis.warnings.length} 条告警 · {workflow.sharedWorkflowId ? "已推送共享区" : "实例级草稿"}</small>
                      </div>
                    </button>
                  ))}
                  {workflows.length === 0 ? (
                    <div className="empty-state empty-state--compact">
                      <p>当前实例还没有工作流草稿</p>
                      <p>先上传一个 ComfyUI API workflow JSON，系统才会开始自动解析。</p>
                    </div>
                  ) : null}
                </div>
              </aside>

              <div className="admin-comfyui-governance-main">
                {selectedWorkflow ? (
                  <AdminComfyuiWorkflowCard
                    workflow={selectedWorkflow}
                    availableInstances={availableInstances}
                    onSave={saveWorkflow}
                    onPushToShared={pushWorkflowToShared}
                    onDelete={deleteWorkflow}
                  />
                ) : (
                  <div className="data-panel empty-state admin-comfyui-governance-empty">
                    <Workflow aria-hidden="true" />
                    <p>还没有选中的工作流草稿</p>
                    <p>左侧创建或选择一个草稿后，这里会显示完整的映射治理工作台。</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "logs" && instance ? (
          <div className="data-panel admin-comfyui-logs-panel">
            <div className="admin-comfyui-panel-head">
              <div>
                <h2>执行日志 Beta</h2>
                <p>本轮先优先收口工作流解析和映射治理，日志区先降级为后续补齐项。</p>
              </div>
            </div>
            <div className="admin-comfyui-beta-note">
              <div className="admin-comfyui-beta-note__item">
                <strong>后续会补齐</strong>
                <span>实例级执行记录、错误栈、平均耗时和成功率面板。</span>
              </div>
              <div className="admin-comfyui-beta-note__item">
                <strong>当前建议</strong>
                <span>优先在“工作流治理”里确认输入输出映射，因为这才是 ComfyUI 链路稳定性的前置条件。</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
