import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bot, Boxes, Plus, RefreshCw, Search, Workflow } from "lucide-react";
import { adminRunningHubApi } from "./admin-api-client";
import { AdminRunningHubItemEditor } from "./admin-runninghub-item-editor";
import type {
  RunningHubAdminItem,
  RunningHubAdminItemTestResult,
  RunningHubAdminItemCreatePayload,
  RunningHubAdminItemUpdatePayload,
  RunningHubAnalyzeDraft,
  RunningHubAnalyzeDraftSection,
} from "./admin-types";

type RunningHubWorkspaceTab = "workflow" | "app";
type RunningHubStatusFilter = "all" | "enabled" | "disabled";

function countSchemaProperties(parameterSchema: string | undefined) {
  if (!parameterSchema?.trim()) return 0;
  try {
    const parsed = JSON.parse(parameterSchema) as { properties?: Record<string, unknown> };
    return parsed.properties && typeof parsed.properties === "object" ? Object.keys(parsed.properties).length : 0;
  } catch {
    return 0;
  }
}

function buildCreateTitle(kind: RunningHubWorkspaceTab) {
  return kind === "workflow" ? "新建工作流" : "新建 AI 应用";
}

function readMeaningfulDraftText(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.trim() ? value : undefined;
}

function buildCreatePayloadFromDraft(
  providerId: string,
  kind: RunningHubWorkspaceTab,
  section?: RunningHubAnalyzeDraftSection | null,
): RunningHubAdminItemCreatePayload {
  const payload: RunningHubAdminItemCreatePayload = {
    providerId,
    kind,
    title: buildCreateTitle(kind),
  };
  if (!section) return payload;
  if (section.key === "base") {
    payload.title = readMeaningfulDraftText(section.payload.title) ?? payload.title;
    payload.note = readMeaningfulDraftText(section.payload.note) ?? payload.note;
    payload.pageId = readMeaningfulDraftText(section.payload.pageId) ?? payload.pageId;
    payload.runTargetId = readMeaningfulDraftText(section.payload.runTargetId) ?? payload.runTargetId;
    payload.taskCapability = ["image", "video", "audio", "chat"].includes(String(section.payload.taskCapability))
      ? section.payload.taskCapability as RunningHubAdminItemCreatePayload["taskCapability"]
      : payload.taskCapability;
  } else if (section.key === "inputs") {
    payload.fields = Array.isArray(section.payload.fields) ? section.payload.fields as RunningHubAdminItemCreatePayload["fields"] : [];
  } else if (section.key === "params") {
    payload.parameterSchema = JSON.stringify(section.payload, null, 2);
  } else if (section.key === "outputs") {
    payload.outputSchema = Array.isArray(section.payload.outputs) ? section.payload.outputs as RunningHubAdminItemCreatePayload["outputSchema"] : [];
  } else if (section.key === "execution") {
    payload.executionRules = section.payload as unknown as RunningHubAdminItemCreatePayload["executionRules"];
  }
  return payload;
}

function mergeDraftSectionsToCreatePayload(
  providerId: string,
  kind: RunningHubWorkspaceTab,
  sections: RunningHubAnalyzeDraftSection[],
) {
  return sections.reduce<RunningHubAdminItemCreatePayload>(
    (acc, section) => ({ ...acc, ...buildCreatePayloadFromDraft(providerId, kind, section) }),
    { providerId, kind, title: buildCreateTitle(kind) },
  );
}

function buildUpdatePayloadFromDraft(
  selectedItem: RunningHubAdminItem,
  section?: RunningHubAnalyzeDraftSection | null,
): RunningHubAdminItemUpdatePayload {
  const payload: RunningHubAdminItemUpdatePayload = {};
  if (!section) return payload;
  if (section.key === "base") {
    payload.title = readMeaningfulDraftText(section.payload.title) ?? selectedItem.title;
    payload.note = readMeaningfulDraftText(section.payload.note) ?? selectedItem.note;
    payload.pageId = readMeaningfulDraftText(section.payload.pageId) ?? selectedItem.pageId;
    payload.runTargetId = readMeaningfulDraftText(section.payload.runTargetId) ?? selectedItem.runTargetId;
    payload.taskCapability = ["image", "video", "audio", "chat"].includes(String(section.payload.taskCapability))
      ? section.payload.taskCapability as RunningHubAdminItemUpdatePayload["taskCapability"]
      : selectedItem.taskCapability;
  } else if (section.key === "inputs") {
    payload.fields = Array.isArray(section.payload.fields) ? section.payload.fields as RunningHubAdminItemUpdatePayload["fields"] : [];
  } else if (section.key === "params") {
    payload.parameterSchema = JSON.stringify(section.payload, null, 2);
  } else if (section.key === "outputs") {
    payload.outputSchema = Array.isArray(section.payload.outputs) ? section.payload.outputs as RunningHubAdminItemUpdatePayload["outputSchema"] : [];
  } else if (section.key === "execution") {
    payload.executionRules = section.payload as unknown as RunningHubAdminItemUpdatePayload["executionRules"];
  }
  return payload;
}

function mergeDraftSectionsToUpdatePayload(
  selectedItem: RunningHubAdminItem,
  sections: RunningHubAnalyzeDraftSection[],
) {
  return sections.reduce<RunningHubAdminItemUpdatePayload>(
    (acc, section) => ({ ...acc, ...buildUpdatePayloadFromDraft(selectedItem, section) }),
    {},
  );
}

function renderAnalyzeSectionPreview(section: RunningHubAnalyzeDraftSection): ReactNode {
  if (section.key === "base") {
    const capability = typeof section.payload.taskCapability === "string" ? section.payload.taskCapability : "未识别";
    return (
      <div className="admin-runninghub-analyze-card__grid">
        <div>
          <strong>标题</strong>
          <span>{typeof section.payload.title === "string" ? section.payload.title : "未填写"}</span>
        </div>
        <div>
          <strong>任务能力</strong>
          <span>{capability}</span>
        </div>
        <div>
          <strong>页面 ID</strong>
          <span>{typeof section.payload.pageId === "string" ? section.payload.pageId : "未填写"}</span>
        </div>
        <div>
          <strong>运行目标 ID</strong>
          <span>{typeof section.payload.runTargetId === "string" ? section.payload.runTargetId : "未填写"}</span>
        </div>
        <div className="admin-runninghub-analyze-card__full">
          <strong>备注</strong>
          <span>{typeof section.payload.note === "string" && section.payload.note.trim() ? section.payload.note : "未补充备注"}</span>
        </div>
      </div>
    );
  }
  if (section.key === "inputs") {
    const fields = Array.isArray(section.payload.fields) ? section.payload.fields as Array<Record<string, unknown>> : [];
    return (
      <div className="admin-runninghub-analyze-card__stack">
        {fields.length ? fields.map((field, index) => (
          <div key={`${String(field.nodeId || "")}:${String(field.fieldName || "")}:${index}`} className="admin-runninghub-analyze-card__list-row">
            <div>
              <strong>{String(field.label || field.fieldName || "未命名输入槽")}</strong>
              <span>{String(field.description || "未补充说明")}</span>
            </div>
            <div className="admin-runninghub-analyze-card__chips">
              <em>{String(field.valueType || field.fieldType || "string")}</em>
              <em>{field.required ? "必填" : "可选"}</em>
              <em>{String(field.nodeId || "node")}</em>
            </div>
          </div>
        )) : <div className="admin-runninghub-editor__empty-note">当前没有识别到输入槽。</div>}
      </div>
    );
  }
  if (section.key === "outputs") {
    const outputs = Array.isArray(section.payload.outputs) ? section.payload.outputs as Array<Record<string, unknown>> : [];
    return (
      <div className="admin-runninghub-analyze-card__stack">
        {outputs.length ? outputs.map((output, index) => (
          <div key={`${String(output.key || "")}:${index}`} className="admin-runninghub-analyze-card__list-row">
            <div>
              <strong>{String(output.label || output.key || "未命名输出")}</strong>
              <span>{String(output.path || "data")}</span>
            </div>
            <div className="admin-runninghub-analyze-card__chips">
              <em>{String(output.kind || "image")}</em>
              <em>{output.multiple ? "多结果" : "单结果"}</em>
            </div>
          </div>
        )) : <div className="admin-runninghub-editor__empty-note">当前没有识别到输出定义。</div>}
      </div>
    );
  }
  if (section.key === "execution") {
    return (
      <div className="admin-runninghub-analyze-card__grid">
        <div>
          <strong>提交方式</strong>
          <span>{String(section.payload.submitMode || "direct")}</span>
        </div>
        <div>
          <strong>目标类型</strong>
          <span>{String(section.payload.targetType || "workflow")}</span>
        </div>
        <div className="admin-runninghub-analyze-card__full">
          <strong>接口路径</strong>
          <span>{String(section.payload.endpoint || "") || "未填写"}</span>
        </div>
        <div>
          <strong>结果路径</strong>
          <span>{String(section.payload.resultPath || "data")}</span>
        </div>
        <div>
          <strong>错误路径</strong>
          <span>{String(section.payload.errorPath || "message")}</span>
        </div>
        <div>
          <strong>轮询策略</strong>
          <span>{String(section.payload.pollingStrategy || "none")}</span>
        </div>
      </div>
    );
  }
  return <pre>{JSON.stringify(section.payload, null, 2)}</pre>;
}

export function AdminRunningHubWorkspace({
  selectedProviderId = "",
}: {
  selectedProviderId?: string;
}) {
  const [items, setItems] = useState<RunningHubAdminItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<RunningHubWorkspaceTab>("workflow");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [testResult, setTestResult] = useState<RunningHubAdminItemTestResult | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunningHubStatusFilter>("all");
  const [analyzeDraft, setAnalyzeDraft] = useState<RunningHubAnalyzeDraft | null>(null);
  const [analyzePageId, setAnalyzePageId] = useState("");
  const [analyzeRunTargetId, setAnalyzeRunTargetId] = useState("");
  const [analyzeDocUrl, setAnalyzeDocUrl] = useState("");
  const [analyzeRequestExample, setAnalyzeRequestExample] = useState("");
  const [analyzeResponseExample, setAnalyzeResponseExample] = useState("");
  const [analyzeNotes, setAnalyzeNotes] = useState("");

  async function loadItems() {
    setBusy(true);
    setError("");
    try {
      const nextItems = await adminRunningHubApi.listItems();
      setItems(nextItems);
      if (!nextItems.some((item) => item.catalogId === selectedCatalogId)) {
        const fallback = nextItems.find(
          (item) =>
            item.kind === (activeTab === "workflow" ? "workflow" : "app")
            && (!selectedProviderId || item.providerId === selectedProviderId),
        ) || nextItems.find((item) => item.kind === (activeTab === "workflow" ? "workflow" : "app"));
        setSelectedCatalogId(fallback?.catalogId || "");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [selectedProviderId]);

  const scopedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.kind === (activeTab === "workflow" ? "workflow" : "app")
          && (!selectedProviderId || item.providerId === selectedProviderId),
      ),
    [activeTab, items, selectedProviderId],
  );

  const filteredItems = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();
    return scopedItems.filter((item) => {
      if (statusFilter === "enabled" && !item.enabled) return false;
      if (statusFilter === "disabled" && item.enabled) return false;
      if (!lowerKeyword) return true;
      return [
        item.title,
        item.note,
        item.providerName,
        item.catalogId,
        item.taskCapability,
      ].join("\n").toLowerCase().includes(lowerKeyword);
    });
  }, [keyword, scopedItems, statusFilter]);

  useEffect(() => {
    if (!filteredItems.some((item) => item.catalogId === selectedCatalogId)) {
      setSelectedCatalogId(filteredItems[0]?.catalogId || "");
    }
  }, [filteredItems, selectedCatalogId]);

  useEffect(() => {
    setTestResult(null);
  }, [selectedCatalogId]);

  const selectedItem = scopedItems.find((item) => item.catalogId === selectedCatalogId) || null;
  const workflowCount = items.filter((item) => item.kind === "workflow").length;
  const appCount = items.filter((item) => item.kind === "app").length;

  async function handleCreate(kind: RunningHubWorkspaceTab, sourceCatalogId?: string, preset?: RunningHubAdminItemCreatePayload) {
    const providerId = selectedProviderId || items.find((item) => item.providerId)?.providerId || "runninghub";
    setCreating(true);
    setError("");
    try {
      const created = await adminRunningHubApi.createItem(
        preset || {
          providerId,
          kind,
          title: sourceCatalogId ? undefined : buildCreateTitle(kind),
          sourceCatalogId,
        },
      );
      setItems((current) => [...current, created]);
      setActiveTab(kind);
      setSelectedCatalogId(created.catalogId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(catalogId: string, payload: RunningHubAdminItemUpdatePayload) {
    setSaving(true);
    setError("");
    try {
      const updated = await adminRunningHubApi.updateItem(catalogId, payload);
      setItems((current) => current.map((item) => (item.catalogId === catalogId ? updated : item)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(catalogId: string) {
    setSaving(true);
    setError("");
    try {
      await adminRunningHubApi.deleteItem(catalogId);
      setItems((current) => current.filter((item) => item.catalogId !== catalogId));
      setSelectedCatalogId("");
      setTestResult(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(catalogId: string, enabled: boolean) {
    await handleSave(catalogId, { enabled });
  }

  async function handleTest(catalogId: string, payload: { testPayload?: string }) {
    setTesting(true);
    setError("");
    try {
      const result = await adminRunningHubApi.testItem(catalogId, payload);
      setTestResult(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  }

  async function handleAnalyze() {
    const providerId = selectedProviderId || selectedItem?.providerId || items.find((item) => item.providerId)?.providerId || "runninghub";
    setAnalyzing(true);
    setError("");
    try {
      const draft = await adminRunningHubApi.analyzeItemDraft({
        providerId,
        kind: activeTab,
        pageId: analyzePageId,
        runTargetId: analyzeRunTargetId,
        docUrl: analyzeDocUrl,
        requestExample: analyzeRequestExample,
        responseExample: analyzeResponseExample,
        notes: analyzeNotes,
      });
      setAnalyzeDraft(draft);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setAnalyzeDraft(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyAnalyzeSection(section: RunningHubAnalyzeDraftSection) {
    if (!selectedItem) {
      setError("请先在左侧选择一个 RunningHub 条目，再应用草案卡片。");
      return;
    }
    const payload = buildUpdatePayloadFromDraft(selectedItem, section);
    await handleSave(selectedItem.catalogId, payload);
  }

  async function applyAnalyzeDraft() {
    if (!selectedItem || !analyzeDraft) {
      setError("请先选择条目并生成 RH 草案，再应用全部。");
      return;
    }
    const payload = mergeDraftSectionsToUpdatePayload(selectedItem, analyzeDraft.sections);
    await handleSave(selectedItem.catalogId, payload);
  }

  return (
    <section className="admin-runninghub-workspace">
      <div className="admin-runninghub-workspace__hero">
        <div className="admin-runninghub-workspace__hero-copy">
          <span>RunningHub Provider Workspace</span>
          <h2>RunningHub 工作台</h2>
          <p>统一维护 RH 工作流和 AI 应用目录，左侧管理条目，右侧做结构化编辑和测试运行。</p>
          {selectedProviderId ? (
            <small className="admin-runninghub-workspace__provider-hint">当前来自 Provider：{selectedProviderId}</small>
          ) : null}
        </div>
        <div className="admin-runninghub-workspace__toolbar">
          <button type="button" className="ghost-action" onClick={() => void loadItems()} disabled={busy}>
            <RefreshCw aria-hidden="true" className={busy ? "spin" : ""} /> 刷新目录
          </button>
          <button type="button" className="ghost-action" onClick={() => void handleCreate("workflow")} disabled={creating}>
            <Plus aria-hidden="true" /> 新建工作流
          </button>
          <button type="button" className="ghost-action" onClick={() => void handleCreate("app")} disabled={creating}>
            <Plus aria-hidden="true" /> 新建 AI 应用
          </button>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="admin-runninghub-workspace__stats">
        <article className="admin-runninghub-workspace__stat-card">
          <Workflow aria-hidden="true" />
          <strong>{workflowCount}</strong>
          <span>工作流</span>
        </article>
        <article className="admin-runninghub-workspace__stat-card">
          <Boxes aria-hidden="true" />
          <strong>{appCount}</strong>
          <span>AI 应用</span>
        </article>
      </div>

      <div className="admin-runninghub-workspace__sticky-shell">
        <div className="admin-runninghub-workspace__filters">
          <label className="admin-runninghub-workspace__search">
            <Search aria-hidden="true" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、备注、目录 ID" />
          </label>
          <div className="admin-runninghub-workspace__tabs" role="tablist" aria-label="RunningHub 分类">
            <button type="button" className={activeTab === "workflow" ? "active" : ""} onClick={() => setActiveTab("workflow")}>工作流</button>
            <button type="button" className={activeTab === "app" ? "active" : ""} onClick={() => setActiveTab("app")}>AI 应用</button>
          </div>
          <div className="admin-runninghub-workspace__status-filter" role="tablist" aria-label="RunningHub 状态筛选">
            <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>全部</button>
            <button type="button" className={statusFilter === "enabled" ? "active" : ""} onClick={() => setStatusFilter("enabled")}>启用</button>
            <button type="button" className={statusFilter === "disabled" ? "active" : ""} onClick={() => setStatusFilter("disabled")}>停用</button>
          </div>
        </div>
      </div>

      <div className="admin-runninghub-workspace__layout">
        <aside className="api-card admin-runninghub-workspace__rail">
          <div className="admin-runninghub-workspace__rail-head">
            <strong>{activeTab === "workflow" ? "工作流目录" : "AI 应用目录"}</strong>
            <span>左侧只负责选条目，右侧统一编辑、测试、保存和删除。</span>
          </div>
          <div className="admin-runninghub-workspace__list-body">
            {filteredItems.length ? (
              filteredItems.map((item) => (
                <button
                  key={item.catalogId}
                  type="button"
                  className={selectedCatalogId === item.catalogId ? "admin-runninghub-list-item active" : "admin-runninghub-list-item"}
                  onClick={() => setSelectedCatalogId(item.catalogId)}
                >
                  {(() => {
                    const validFieldCount = Array.isArray(item.fields)
                      ? item.fields.filter((field) => String(field.nodeId || "").trim() && String(field.fieldName || "").trim()).length
                      : 0;
                    const schemaPropertyCount = countSchemaProperties(item.parameterSchema);
                    return (
                      <>
                  <div className="admin-runninghub-list-item__icon">
                    {item.kind === "workflow" ? <Workflow aria-hidden="true" /> : <Boxes aria-hidden="true" />}
                  </div>
                  <div className="admin-runninghub-list-item__copy">
                    <strong>{item.title || item.catalogId}</strong>
                    <span>{item.note?.trim() || "未补充备注"}</span>
                    <small>{item.kind === "workflow" ? "工作流" : "AI 应用"} · {item.taskCapability || "video"} · 绑定 {validFieldCount} · Schema {schemaPropertyCount}</small>
                    {validFieldCount <= 0
                      ? <small className="text-amber-300">{schemaPropertyCount > 0 ? "已有结构化参数草案，但仍待补 RH 绑定字段" : "待补输入槽，启用后节点不会展开参数区"}</small>
                      : null}
                  </div>
                  <div className="admin-runninghub-list-item__meta">
                    <em>{item.enabled ? "启用" : "停用"}</em>
                    <small>{item.providerName}</small>
                  </div>
                      </>
                    );
                  })()}
                </button>
              ))
            ) : (
              <div className="empty-models">
                当前分类暂无条目
                <div className="admin-runninghub-editor__empty-note">如果 gray / production 有数据而本地为 0，通常是本地后台库尚未写入 RunningHub Provider 或 RH 目录条目。</div>
              </div>
            )}
          </div>
          <div className="admin-runninghub-workspace__rail-footer">
            <button type="button" className="ghost-action" onClick={() => void handleCreate(activeTab)} disabled={creating}>
              <Plus aria-hidden="true" /> {activeTab === "workflow" ? "新增工作流" : "新增 AI 应用"}
            </button>
          </div>
        </aside>

        <div className="admin-runninghub-workspace__editor-stack">
          <AdminRunningHubItemEditor
            item={selectedItem}
            saving={saving}
            testing={testing}
            testResult={testResult}
            onSave={handleSave}
            onTest={handleTest}
            onDelete={handleDelete}
            onDuplicate={(catalogId) => handleCreate(activeTab, catalogId)}
            onToggleEnabled={handleToggleEnabled}
          />

          <section className="api-card admin-runninghub-analyze-panel">
            <div className="admin-runninghub-workspace__section-head">
              <div>
                <strong>AI 分析并填写</strong>
                <span>输出结构化草案卡片，而不是散乱文本。</span>
              </div>
              <button type="button" className="ghost-action" onClick={() => void handleAnalyze()} disabled={analyzing}>
                <Bot aria-hidden="true" /> {analyzing ? "分析中..." : analyzeDraft ? "重新分析" : "AI 分析并填写"}
              </button>
            </div>
            <div className="admin-runninghub-analyze-panel__workbench">
              <div className="admin-runninghub-analyze-panel__form">
                <label>
                  <span>页面 ID</span>
                  <input value={analyzePageId} onChange={(event) => setAnalyzePageId(event.target.value)} placeholder="2004516402230509570" />
                </label>
                <label>
                  <span>运行目标 ID</span>
                  <input value={analyzeRunTargetId} onChange={(event) => setAnalyzeRunTargetId(event.target.value)} placeholder="1997246493079834625" />
                </label>
                <label className="admin-runninghub-analyze-panel__full-row">
                  <span>文档链接</span>
                  <input value={analyzeDocUrl} onChange={(event) => setAnalyzeDocUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label className="admin-runninghub-analyze-panel__full-row">
                  <span>备注线索</span>
                  <textarea value={analyzeNotes} onChange={(event) => setAnalyzeNotes(event.target.value)} rows={4} />
                </label>
                <label className="admin-runninghub-analyze-panel__full-row">
                  <span>请求示例</span>
                  <textarea
                    value={analyzeRequestExample}
                    onChange={(event) => setAnalyzeRequestExample(event.target.value)}
                    rows={6}
                    placeholder='{"runTargetId":"1997246493079834625","nodeInfoList":[{"nodeId":"12","fieldName":"prompt","fieldValue":"a cat"}]}'
                  />
                </label>
                <label className="admin-runninghub-analyze-panel__full-row">
                  <span>响应示例</span>
                  <textarea
                    value={analyzeResponseExample}
                    onChange={(event) => setAnalyzeResponseExample(event.target.value)}
                    rows={6}
                    placeholder='{"code":0,"data":{"taskId":"rh-task-001"}}'
                  />
                </label>
              </div>
              <aside className="admin-runninghub-analyze-panel__brief">
                <strong>分析工作台</strong>
                <div className="admin-runninghub-analyze-panel__brief-list">
                  <div>
                    <span>输入来源</span>
                    <em>页面 ID / 运行目标 / 文档链接 / 请求示例 / 响应示例 / 备注线索</em>
                  </div>
                  <div>
                    <span>输出结果</span>
                    <em>基础信息、输入槽、Schema、输出、执行规则草案</em>
                  </div>
                  <div>
                    <span>应用方式</span>
                    <em>单卡应用、整套应用、或直接新建 RH 条目</em>
                  </div>
                </div>
              </aside>
            </div>
            {analyzeDraft ? (
              <div className="admin-runninghub-analyze-panel__cards">
                <div className="admin-runninghub-analyze-panel__summary">{analyzeDraft.summary}</div>
                {analyzeDraft.sections.map((section) => (
                  <article key={section.key} className="admin-runninghub-analyze-card">
                    <div className="admin-runninghub-workspace__section-head">
                      <div>
                        <strong>{section.title}</strong>
                        <span>{section.description}</span>
                      </div>
                      <div className="admin-runninghub-analyze-card__actions">
                        <button type="button" className="ghost-action" onClick={() => void applyAnalyzeSection(section)}>只应用本卡</button>
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={() => void handleCreate(activeTab, undefined, buildCreatePayloadFromDraft(selectedProviderId || selectedItem?.providerId || "runninghub", activeTab, section))}
                        >
                          插入为新条目
                        </button>
                      </div>
                    </div>
                    {renderAnalyzeSectionPreview(section)}
                    {section.key === "params" ? <pre>{JSON.stringify(section.payload, null, 2)}</pre> : null}
                  </article>
                ))}
                <div className="admin-runninghub-analyze-card__actions">
                  <button type="button" className="ghost-action" onClick={() => void applyAnalyzeDraft()}>应用全部</button>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void handleCreate(activeTab, undefined, mergeDraftSectionsToCreatePayload(selectedProviderId || selectedItem?.providerId || "runninghub", activeTab, analyzeDraft.sections))}
                  >
                    用草案新建条目
                  </button>
                </div>
                <div className="admin-runninghub-analyze-panel__warnings">
                  {analyzeDraft.warnings.map((warning, index) => <span key={`${warning}-${index}`}>{warning}</span>)}
                </div>
              </div>
            ) : (
              <div className="admin-runninghub-editor__empty-note">点击 “AI 分析并填写” 后，这里会显示基础信息草案、输入槽草案、参数 Schema 草案、输出定义草案和执行规则草案。</div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
