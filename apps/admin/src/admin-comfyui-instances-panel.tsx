import { Plus, RefreshCw, ServerCog, Workflow, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminComfyuiApi } from "./admin-api-client";
import { AdminWorkspaceBand } from "./admin-common-components";
import { AdminComfyuiWorkflowCard, type ComfyuiWorkflowEditPayload } from "./admin-comfyui-workflow-card";
import type { ComfyuiInstanceRecord, ComfyuiWorkflowDraft } from "./admin-types";

function splitCapabilities(text: string) {
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return "";
  }
}

export function AdminComfyuiInstancesPanel() {
  const [instances, setInstances] = useState<ComfyuiInstanceRecord[]>([]);
  const [sharedWorkflows, setSharedWorkflows] = useState<ComfyuiWorkflowDraft[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
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

  const selectedInstance = useMemo(
    () => instances.find((item) => item.id === selectedInstanceId) || null,
    [instances, selectedInstanceId],
  );

  async function loadInstances(nextSelectedId?: string) {
    setLoading(true);
    setMessage("");
    try {
      const result = await adminComfyuiApi.listInstances();
      setInstances(result.instances);
      setSharedWorkflows(result.sharedWorkflows);
      const nextId = nextSelectedId
        || (result.instances.some((item) => item.id === selectedInstanceId) ? selectedInstanceId : result.instances[0]?.id || "");
      setSelectedInstanceId(nextId);
      if (nextId && nextId !== selectedInstanceId) {
        const instance = result.instances.find((item) => item.id === nextId) || null;
        if (instance) {
          setInstanceForm({
            id: instance.id,
            name: instance.name,
            baseUrl: instance.baseUrl,
            tailscaleAddress: instance.tailscaleAddress,
            concurrency: String(instance.concurrency || 1),
            capabilitiesText: instance.capabilities.join(", "),
            note: instance.note || "",
            connectorVersion: instance.connectorVersion || "",
          });
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkflows(instanceId: string) {
    if (!instanceId) {
      setWorkflows([]);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const nextWorkflows = await adminComfyuiApi.listWorkflows(instanceId);
      setWorkflows(nextWorkflows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInstances();
  }, []);

  useEffect(() => {
    if (!selectedInstanceId && instances[0]?.id) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    if (selectedInstance) {
      setInstanceForm({
        id: selectedInstance.id,
        name: selectedInstance.name,
        baseUrl: selectedInstance.baseUrl,
        tailscaleAddress: selectedInstance.tailscaleAddress,
        concurrency: String(selectedInstance.concurrency || 1),
        capabilitiesText: selectedInstance.capabilities.join(", "),
        note: selectedInstance.note || "",
        connectorVersion: selectedInstance.connectorVersion || "",
      });
    }
  }, [selectedInstance]);

  useEffect(() => {
    void loadWorkflows(selectedInstanceId);
  }, [selectedInstanceId]);

  const selectedSharedCount = sharedWorkflows.filter((workflow) => workflow.instanceId === selectedInstanceId).length;

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
      await loadInstances(saved.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function heartbeatInstance() {
    if (!instanceForm.id) return;
    setLoading(true);
    setMessage("");
    try {
      const saved = await adminComfyuiApi.heartbeatInstance(instanceForm.id, {
        id: instanceForm.id,
        name: instanceForm.name,
        baseUrl: instanceForm.baseUrl,
        tailscaleAddress: instanceForm.tailscaleAddress,
        concurrency: Number(instanceForm.concurrency) || 1,
        capabilities: splitCapabilities(instanceForm.capabilitiesText),
        note: instanceForm.note,
        connectorVersion: instanceForm.connectorVersion,
      });
      setMessage(`已刷新心跳：${saved.name}`);
      await loadInstances(saved.id);
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
      await loadInstances();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function createWorkflowFromJson() {
    if (!selectedInstanceId) return;
    const text = workflowJsonText.trim();
    if (!text) {
      setMessage("请先粘贴 ComfyUI workflow JSON");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const workflowJson = JSON.parse(text) as Record<string, unknown>;
      const created = await adminComfyuiApi.createWorkflow(selectedInstanceId, {
        title: workflowTitle.trim() || "ComfyUI 工作流",
        workflowJson,
      });
      setWorkflowTitle("");
      setWorkflowJsonText("");
      setMessage(`已创建工作流：${created.title}`);
      await loadWorkflows(selectedInstanceId);
      await loadInstances(selectedInstanceId);
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
    if (!selectedInstanceId) return;
    const saved = await adminComfyuiApi.updateWorkflow(selectedInstanceId, workflowId, payload);
    setMessage(`已保存工作流：${saved.title}`);
    await loadWorkflows(selectedInstanceId);
    await loadInstances(selectedInstanceId);
  }

  async function pushWorkflowToShared(workflowId: string) {
    if (!selectedInstanceId) return;
    const result = await adminComfyuiApi.pushWorkflowToShared(selectedInstanceId, workflowId);
    setMessage(`已推送到共享区：${result.sharedWorkflow.title}`);
    await loadWorkflows(selectedInstanceId);
    await loadInstances(selectedInstanceId);
  }

  async function deleteWorkflow(workflowId: string) {
    if (!selectedInstanceId) return;
    await adminComfyuiApi.deleteWorkflow(selectedInstanceId, workflowId);
    setMessage("工作流已删除");
    await loadWorkflows(selectedInstanceId);
    await loadInstances(selectedInstanceId);
  }

  return (
    <section className="admin-comfyui-page">
      <AdminWorkspaceBand
        className="admin-comfyui-band"
        kicker="ComfyUI Instance Governance"
        title="ComfyUI 实例池"
        description="按机器实例管理工作流草稿、暴露参数、默认值和共享发布。"
        currentLabel={selectedInstance?.name || "未选择实例"}
        currentDescription={selectedInstance
          ? `${selectedInstance.baseUrl} · ${selectedInstance.health} · ${selectedSharedCount} 个共享工作流`
          : "先创建或选择一台机器实例，再管理它的工作流草稿。"}
        actions={
          <div className="admin-public-resources-band__actions">
            <button type="button" onClick={() => void loadInstances(selectedInstanceId)} disabled={loading}>
              <RefreshCw aria-hidden="true" />
              刷新
            </button>
          </div>
        }
        footer={
          <div className="admin-workspace-band__meta-pills">
            <span>{instances.length} 台机器</span>
            <span>{sharedWorkflows.length} 个共享工作流</span>
          </div>
        }
      />

      {message ? <div className="error-banner">{message}</div> : null}

      <div className="admin-comfyui-layout">
        <aside className="data-panel admin-comfyui-sidebar">
          <header className="admin-comfyui-panel-header">
            <div>
              <h2>机器实例</h2>
              <p>先管机器，再管它下面的工作流。</p>
            </div>
          </header>

          <div className="form-grid admin-comfyui-instance-form">
            <label>
              <span>实例名称</span>
              <input value={instanceForm.name} onChange={(event) => setInstanceForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Base URL</span>
              <input value={instanceForm.baseUrl} onChange={(event) => setInstanceForm((current) => ({ ...current, baseUrl: event.target.value }))} />
            </label>
            <label>
              <span>Tailscale 地址</span>
              <input value={instanceForm.tailscaleAddress} onChange={(event) => setInstanceForm((current) => ({ ...current, tailscaleAddress: event.target.value }))} />
            </label>
            <label>
              <span>并发</span>
              <input type="number" min={1} value={instanceForm.concurrency} onChange={(event) => setInstanceForm((current) => ({ ...current, concurrency: event.target.value }))} />
            </label>
            <label>
              <span>能力</span>
              <input value={instanceForm.capabilitiesText} onChange={(event) => setInstanceForm((current) => ({ ...current, capabilitiesText: event.target.value }))} />
            </label>
            <label>
              <span>连接备注</span>
              <textarea rows={2} value={instanceForm.note} onChange={(event) => setInstanceForm((current) => ({ ...current, note: event.target.value }))} />
            </label>
          </div>

          <div className="admin-comfyui-actions">
            <button type="button" onClick={() => void saveInstance()} disabled={loading}>
              <Plus aria-hidden="true" />
              保存实例
            </button>
            <button type="button" onClick={() => void heartbeatInstance()} disabled={loading || !instanceForm.id}>
              <RefreshCw aria-hidden="true" />
              刷新心跳
            </button>
            <button type="button" className="danger" onClick={() => void deleteInstance()} disabled={loading || !instanceForm.id}>
              <ServerCog aria-hidden="true" />
              删除实例
            </button>
          </div>

          <div className="admin-comfyui-instance-list">
            {instances.map((instance) => (
              <button
                key={instance.id}
                type="button"
                className={instance.id === selectedInstanceId ? "admin-comfyui-instance-card active" : "admin-comfyui-instance-card"}
                onClick={() => setSelectedInstanceId(instance.id)}
              >
                <strong>{instance.name}</strong>
                <small>{instance.baseUrl}</small>
                <span>{instance.health} · {instance.capabilities.join(", ") || "无能力标签"}</span>
              </button>
            ))}
            {!instances.length ? <div className="empty-state">还没有 ComfyUI 实例，先新建一台机器。</div> : null}
          </div>
        </aside>

        <section className="data-panel admin-comfyui-workspace">
          <header className="admin-comfyui-panel-header">
            <div>
              <h2>实例工作流</h2>
              <p>编辑暴露参数、默认值和输出，再推送到共享区。</p>
            </div>
          </header>

          <div className="form-grid admin-comfyui-create-workflow">
            <label>
              <span>工作流标题</span>
              <input value={workflowTitle} onChange={(event) => setWorkflowTitle(event.target.value)} placeholder="从本地 JSON 创建一个工作流草稿" />
            </label>
            <label className="admin-comfyui-create-workflow__span-2">
              <span>工作流 JSON</span>
              <textarea
                value={workflowJsonText}
                onChange={(event) => setWorkflowJsonText(event.target.value)}
                rows={8}
                placeholder='粘贴本机 ComfyUI 导出的 API workflow JSON'
              />
            </label>
            <label className="admin-comfyui-create-workflow__span-2">
              <span>本地 JSON 文件</span>
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
            <button type="button" onClick={() => void createWorkflowFromJson()} disabled={loading || !selectedInstanceId}>
              <Upload aria-hidden="true" />
              创建工作流草稿
            </button>
            <button type="button" onClick={() => workflowFileRef.current?.click()} disabled={!selectedInstanceId || loading}>
              <Workflow aria-hidden="true" />
              选择 JSON 文件
            </button>
          </div>

          {selectedInstanceId ? (
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
              {!workflows.length ? <div className="empty-state">当前实例还没有工作流草稿。</div> : null}
            </div>
          ) : (
            <div className="empty-state">先选择或新建一台 ComfyUI 实例。</div>
          )}
        </section>
      </div>
    </section>
  );
}

export default AdminComfyuiInstancesPanel;
