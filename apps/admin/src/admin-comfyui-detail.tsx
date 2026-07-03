import { ArrowLeft, Plus, RefreshCw, Save, Trash2, Upload, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { adminComfyuiApi } from "./admin-api-client";
import { AdminComfyuiWorkflowCard, type ComfyuiWorkflowEditPayload } from "./admin-comfyui-workflow-card";
import type { ComfyuiInstanceRecord, ComfyuiWorkflowDraft } from "./admin-types";

interface ComfyuiDetailProps {
  instanceId: string;
  onBack: () => void;
}

type DetailTab = "config" | "workflows" | "logs";

function splitCapabilities(text: string) {
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AdminComfyuiDetail({ instanceId, onBack }: ComfyuiDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("config");
  const [instance, setInstance] = useState<ComfyuiInstanceRecord | null>(null);
  const [workflows, setWorkflows] = useState<ComfyuiWorkflowDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
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

  async function loadInstance() {
    setLoading(true);
    setMessage("");
    try {
      const result = await adminComfyuiApi.listInstances();
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
      setMessage("请先粘贴 ComfyUI workflow JSON");
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
    if (!workflowTitle.trim()) setWorkflowTitle(file.name.replace(/\.json$/i, ""));
  }

  async function saveWorkflow(workflowId: string, payload: ComfyuiWorkflowEditPayload) {
    if (!instanceId || instanceId === "new") return;
    const saved = await adminComfyuiApi.updateWorkflow(instanceId, workflowId, payload);
    setMessage(`已保存工作流：${saved.title}`);
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
    await loadWorkflows();
  }

  return (
    <section className="admin-comfyui-detail-page">
      <header className="admin-comfyui-detail-header">
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          返回实例池
        </button>
        <h1>{instance?.name || "新增实例"}</h1>
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

      <div className="admin-comfyui-detail-tabs">
        <button
          type="button"
          className={activeTab === "config" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("config")}
        >
          基本配置
        </button>
        <button
          type="button"
          className={activeTab === "workflows" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("workflows")}
          disabled={!instance}
        >
          工作流管理 {workflows.length > 0 ? `(${workflows.length})` : ""}
        </button>
        <button
          type="button"
          className={activeTab === "logs" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("logs")}
          disabled={!instance}
        >
          执行日志
        </button>
      </div>

      <div className="admin-comfyui-detail-content">
        {activeTab === "config" ? (
          <div className="data-panel admin-comfyui-config-panel">
            <h2>实例配置</h2>
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
                <span>Base URL</span>
                <input
                  value={instanceForm.baseUrl}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder="http://127.0.0.1:8188"
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
                  placeholder="image, video"
                />
              </label>
              <label className="form-grid__span-2">
                <span>备注</span>
                <textarea
                  rows={3}
                  value={instanceForm.note}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="机器说明、配置信息等"
                />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === "workflows" && instance ? (
          <div className="admin-comfyui-workflows-panel">
            <div className="data-panel admin-comfyui-create-workflow-panel">
              <h2>创建工作流草稿</h2>
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
                    rows={8}
                    placeholder='粘贴 ComfyUI 导出的 API workflow JSON（使用 Z-image 工作流测试）'
                  />
                </label>
                <label className="form-grid__span-2">
                  <span>或上传 JSON 文件</span>
                  <input
                    ref={workflowFileRef}
                    type="file"
                    accept=".json,application/json,text/json"
                    onChange={(event) => {
                      void importWorkflowFile(event.currentTarget.files?.[0] || null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="admin-comfyui-actions">
                <button type="button" onClick={() => void createWorkflowFromJson()} disabled={loading}>
                  <Upload aria-hidden="true" />
                  创建工作流草稿
                </button>
                <button type="button" onClick={() => workflowFileRef.current?.click()} disabled={loading}>
                  <Workflow aria-hidden="true" />
                  选择 JSON 文件
                </button>
              </div>
            </div>

            <div className="admin-comfyui-workflow-list">
              {workflows.map((workflow) => (
                <AdminComfyuiWorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onSave={saveWorkflow}
                  onPushToShared={pushWorkflowToShared}
                  onDelete={deleteWorkflow}
                />
              ))}
              {workflows.length === 0 ? (
                <div className="empty-state">
                  <p>当前实例还没有工作流草稿</p>
                  <p>上传一个 ComfyUI workflow JSON 开始</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === "logs" && instance ? (
          <div className="data-panel admin-comfyui-logs-panel">
            <h2>执行日志</h2>
            <div className="empty-state">
              <p>执行日志功能即将上线</p>
              <p>将显示最近的工作流执行记录、成功率、耗时统计等</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
