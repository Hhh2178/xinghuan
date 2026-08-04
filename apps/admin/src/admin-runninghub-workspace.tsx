import { useEffect, useMemo, useState } from "react";
import { Bot, Boxes, Plus, RefreshCw, Search, SlidersHorizontal, Workflow } from "lucide-react";
import { adminRunningHubApi } from "./admin-api-client";
import {
  AdminConfigurationContext,
  AdminConfigurationLayout,
  AdminConfigurationWorkbench,
} from "./admin-configuration-workbench";
import { AdminRunningHubItemEditor } from "./admin-runninghub-item-editor";
import { AdminRunningHubGroupManager } from "./admin-runninghub-group-manager";
import {
  buildCreateTitle,
  buildCreatePayloadFromDraft,
  buildUpdatePayloadFromDraft,
  countSchemaProperties,
  createEmptyRunningHubKeyPoolDraftItem,
  mergeDraftSectionsToCreatePayload,
  mergeDraftSectionsToUpdatePayload,
  normalizeDefaultRunningHubKeyPoolDraft,
  renderAnalyzeSectionPreview,
  summarizeAnalyzeDraftDrift,
  summarizeRunningHubKeyPoolDraft,
  type RunningHubKeyPoolDraftItem,
  type RunningHubWorkspaceTab,
} from "./admin-runninghub-workspace-helpers";
import type {
  RunningHubAdminItem,
  RunningHubAdminItemTestResult,
  RunningHubAdminItemCreatePayload,
  RunningHubAdminItemUpdatePayload,
  RunningHubAnalyzeDraft,
  RunningHubAnalyzeDraftSection,
  RunningHubGroup,
} from "./admin-types";
import type { AdminRhViewId } from "./admin-view-model";

type RunningHubStatusFilter = "all" | "enabled" | "disabled";
export function AdminRunningHubWorkspace({
  selectedProviderId = "",
  activeView = "workflows",
  onViewChange,
  showLocalNavigation = true,
}: {
  selectedProviderId?: string;
  activeView?: AdminRhViewId;
  onViewChange?: (viewId: AdminRhViewId) => void;
  showLocalNavigation?: boolean;
}) {
  const [items, setItems] = useState<RunningHubAdminItem[]>([]);
  const [groups, setGroups] = useState<RunningHubGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
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
  const [analyzeHint, setAnalyzeHint] = useState("");
  const [analyzePageId, setAnalyzePageId] = useState("");
  const [analyzeRunTargetId, setAnalyzeRunTargetId] = useState("");
  const [analyzeDocUrl, setAnalyzeDocUrl] = useState("");
  const [analyzeRequestExample, setAnalyzeRequestExample] = useState("");
  const [analyzeResponseExample, setAnalyzeResponseExample] = useState("");
  const [analyzeNotes, setAnalyzeNotes] = useState("");
  const [keyPoolOpen, setKeyPoolOpen] = useState(false);
  const [keyPoolSaving, setKeyPoolSaving] = useState(false);
  const [keyPoolDraft, setKeyPoolDraft] = useState<RunningHubKeyPoolDraftItem[]>([]);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);

  useEffect(() => {
    if (activeView === "workflows") setActiveTab("workflow");
    if (activeView === "apps") setActiveTab("app");
    if (activeView === "keys") setKeyPoolOpen(true);
  }, [activeView]);

  useEffect(() => {
    if (!groupDrawerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGroupDrawerOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [groupDrawerOpen]);

  const resolvedProviderId = selectedProviderId || items.find((item) => item.catalogId === selectedCatalogId)?.providerId || items[0]?.providerId || "";

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

  useEffect(() => {
    if (!resolvedProviderId) {
      setGroups([]);
      return;
    }
    void adminRunningHubApi.listGroups(resolvedProviderId)
      .then(setGroups)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : String(nextError)));
  }, [resolvedProviderId]);

  useEffect(() => {
    if (!resolvedProviderId) {
      setKeyPoolDraft([]);
      return;
    }
    let cancelled = false;
    void adminRunningHubApi.listKeyPool(resolvedProviderId)
      .then((list) => {
        if (cancelled) return;
        setKeyPoolDraft(normalizeDefaultRunningHubKeyPoolDraft(list.map((item) => ({ ...item, apiKey: "" }))));
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedProviderId]);

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

  const groupedFilteredItems = useMemo(
    () => filteredItems.filter((item) => {
      if (!selectedGroupId) return true;
      if (selectedGroupId === "ungrouped") return !item.groupId;
      return item.groupId === selectedGroupId;
    }),
    [filteredItems, selectedGroupId],
  );

  useEffect(() => {
    if (!groupedFilteredItems.some((item) => item.catalogId === selectedCatalogId)) {
      setSelectedCatalogId(groupedFilteredItems[0]?.catalogId || "");
    }
  }, [groupedFilteredItems, selectedCatalogId]);

  useEffect(() => {
    setTestResult(null);
  }, [selectedCatalogId]);

  const selectedItem = scopedItems.find((item) => item.catalogId === selectedCatalogId) || null;
  const workflowCount = items.filter((item) => item.kind === "workflow").length;
  const appCount = items.filter((item) => item.kind === "app").length;
  const resolvedProviderLabel = items.find((item) => item.providerId === resolvedProviderId)?.providerName?.trim()
    || resolvedProviderId
    || "未选择 Provider";
  const selectedGroupLabel = selectedGroupId === "ungrouped"
    ? "未分组"
    : groups.find((group) => group.id === selectedGroupId)?.name || "全部条目";
  const analyzeTargetKind = analyzeDraft?.detectedKind === "app"
    ? "app"
    : analyzeDraft?.detectedKind === "workflow"
      ? "workflow"
      : activeTab;
  const analyzeDraftDrift = useMemo(
    () => summarizeAnalyzeDraftDrift(selectedItem, analyzeDraft, analyzeTargetKind),
    [selectedItem, analyzeDraft, analyzeTargetKind],
  );

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
          groupId: selectedGroupId && selectedGroupId !== "ungrouped" ? selectedGroupId : undefined,
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

  async function handleCreateGroup() {
    if (!resolvedProviderId) return;
    const name = window.prompt("请输入新分组名称");
    if (!name?.trim()) return;
    try {
      const group = await adminRunningHubApi.createGroup({ providerId: resolvedProviderId, name: name.trim() });
      setGroups((current) => [...current, group].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-CN")));
      setSelectedGroupId(group.id);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  async function handleDeleteGroup(group: RunningHubGroup) {
    if (!window.confirm(`删除分组“${group.name}”后，条目将移至未分组，不会删除条目。继续吗？`)) return;
    try {
      const result = await adminRunningHubApi.deleteGroup(group.id);
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setItems((current) => current.map((item) => result.ungroupedCatalogIds.includes(item.catalogId) ? { ...item, groupId: undefined, groupName: undefined } : item));
      if (selectedGroupId === group.id) setSelectedGroupId("ungrouped");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  async function handleToggleGroup(group: RunningHubGroup) {
    try {
      const updated = await adminRunningHubApi.updateGroup(group.id, { providerId: group.providerId, enabled: !group.enabled });
      setGroups((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    setGroupDrawerOpen(false);
  }

  async function handleSave(catalogId: string, payload: RunningHubAdminItemUpdatePayload) {
    setSaving(true);
    setError("");
    try {
      const updated = await adminRunningHubApi.updateItem(catalogId, payload);
      setItems((current) => {
        const next = current.filter((item) => item.catalogId !== catalogId && item.catalogId !== updated.catalogId);
        return [...next, updated];
      });
      setSelectedCatalogId(updated.catalogId);
      setActiveTab(updated.kind === "app" ? "app" : "workflow");
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
      const autoSwitchHint = draft.detectedKind && draft.detectedKind !== activeTab
        ? draft.detectedKind === "app"
          ? "检测到这是 AI App，应用草案时会自动迁移到 AI 应用目录"
          : "检测到这是工作流，应用草案时会自动迁移到工作流目录"
        : "";
      setAnalyzeHint(autoSwitchHint || draft.autoSwitchMessage || draft.summary);
      setAnalyzeDraft(draft);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setAnalyzeDraft(null);
      setAnalyzeHint("");
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyAnalyzeSection(section: RunningHubAnalyzeDraftSection) {
    if (!selectedItem) {
      setError("请先在左侧选择一个 RunningHub 条目，再应用草案卡片。");
      return;
    }
    const payload = buildUpdatePayloadFromDraft(selectedItem, analyzeTargetKind, section);
    await handleSave(selectedItem.catalogId, payload);
  }

  async function applyAnalyzeDraft() {
    if (!selectedItem || !analyzeDraft) {
      setError("请先选择条目并生成 RH 草案，再应用全部。");
      return;
    }
    const payload = mergeDraftSectionsToUpdatePayload(selectedItem, analyzeTargetKind, analyzeDraft.sections);
    await handleSave(selectedItem.catalogId, payload);
  }

  async function handleSaveKeyPool() {
    if (!resolvedProviderId) {
      setError("当前没有可用的 RunningHub Provider，无法保存 RH Key 池。");
      return;
    }
    setKeyPoolSaving(true);
    setError("");
    try {
      const saved = await adminRunningHubApi.saveKeyPool(resolvedProviderId, {
        rhKeyPool: normalizeDefaultRunningHubKeyPoolDraft(keyPoolDraft).map((item) => ({
          ...item,
          apiKey: item.apiKey?.trim() || undefined,
        })),
      });
      setKeyPoolDraft(normalizeDefaultRunningHubKeyPoolDraft(saved.map((item) => ({ ...item, apiKey: "" }))));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setKeyPoolSaving(false);
    }
  }

  async function handleDeleteKeyPoolItem(keyId: string) {
    if (!resolvedProviderId) {
      setError("当前没有可用的 RunningHub Provider，无法删除 RH Key。");
      return;
    }
    setKeyPoolSaving(true);
    setError("");
    try {
      const nextList = await adminRunningHubApi.deleteKeyPoolItem(resolvedProviderId, keyId);
      setKeyPoolDraft(normalizeDefaultRunningHubKeyPoolDraft(nextList.map((item) => ({ ...item, apiKey: "" }))));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setKeyPoolSaving(false);
    }
  }

  const keyPoolSummary = useMemo(() => summarizeRunningHubKeyPoolDraft(keyPoolDraft), [keyPoolDraft]);

  return (
    <AdminConfigurationWorkbench label="RunningHub 工作台" className="admin-runninghub-workspace">
      <AdminConfigurationContext
        eyebrow={activeView === "keys" ? "Provider 级 Key 池" : selectedItem?.kind === "app" ? "AI 应用" : "工作流"}
        title={activeView === "keys" ? resolvedProviderLabel : selectedItem?.title || "未选择 RunningHub 条目"}
        description={activeView === "keys"
          ? `${keyPoolSummary.enabledCount} 个启用 Key · 总并发 ${keyPoolSummary.totalConcurrency}`
          : selectedItem?.note || selectedProviderId || "从目录选择条目后开始配置。"}
        status={{
          label: busy || saving || testing || analyzing || keyPoolSaving ? "处理中" : error ? "需要处理" : "配置已载入",
          tone: busy || saving || testing || analyzing || keyPoolSaving ? "warning" : error ? "danger" : "success",
        }}
        actions={<div className="admin-runninghub-workspace__toolbar">
          <button type="button" className="ghost-action" onClick={() => void loadItems()} disabled={busy}>
            <RefreshCw aria-hidden="true" className={busy ? "spin" : ""} /> 刷新目录
          </button>
          <button type="button" className="ghost-action" onClick={() => void handleCreate("workflow")} disabled={creating}>
            <Plus aria-hidden="true" /> 新建工作流
          </button>
          <button type="button" className="ghost-action" onClick={() => void handleCreate("app")} disabled={creating}>
            <Plus aria-hidden="true" /> 新建 AI 应用
          </button>
        </div>}
      />

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

      {activeView === "keys" ? <section className="api-card admin-runninghub-key-pool-panel">
        <div className="admin-runninghub-workspace__section-head admin-runninghub-key-pool-panel__head">
          <div className="admin-runninghub-key-pool-panel__copy">
            <span className="admin-runninghub-key-pool-panel__kicker">Provider 级共享 Key 池</span>
            <strong>RH Key 池管理</strong>
            <span>当前 Provider：{resolvedProviderLabel} · {keyPoolSummary.enabledCount} 个启用 · 总并发 {keyPoolSummary.totalConcurrency}</span>
            <small>统一作用于该 RunningHub Provider 下的全部工作流和 AI 应用，不属于当前选中的单个条目。</small>
          </div>
          <button
            type="button"
            className="ghost-action"
            onClick={() => setKeyPoolOpen((current) => !current)}
            aria-expanded={keyPoolOpen}
            aria-controls="admin-runninghub-key-pool-body"
          >
            {keyPoolOpen ? "收起 Key 池" : "展开 Key 池"}
          </button>
        </div>
        {keyPoolOpen ? (
          <div id="admin-runninghub-key-pool-body" className="admin-runninghub-key-pool-panel__body">
            <div className="admin-runninghub-key-pool-panel__toolbar">
              <button
                type="button"
                className="ghost-action"
                onClick={() => setKeyPoolDraft((current) => normalizeDefaultRunningHubKeyPoolDraft([...current, createEmptyRunningHubKeyPoolDraftItem()]))}
                disabled={!resolvedProviderId}
              >
                <Plus aria-hidden="true" /> 新增 Key
              </button>
              <button type="button" className="ghost-action" onClick={() => void handleSaveKeyPool()} disabled={keyPoolSaving || !resolvedProviderId}>
                {keyPoolSaving ? "保存中..." : "保存 Key 池"}
              </button>
            </div>
            <div className="admin-runninghub-key-pool-panel__list">
              {keyPoolDraft.length ? keyPoolDraft.map((item) => (
                <div key={item.id} className="admin-runninghub-key-pool-row">
                  <div className="admin-runninghub-key-pool-row__head">
                    <div className="admin-runninghub-key-pool-row__copy">
                      <strong>{item.note.trim() || item.apiKeyPreview || item.id}</strong>
                      <span>{item.isDefault ? `默认 Key · ${item.apiKeyPreview || "新 Key 尚未保存"}` : item.apiKeyPreview || "新 Key 尚未保存"}</span>
                    </div>
                    <div className="admin-runninghub-analyze-card__actions">
                      <button
                        type="button"
                        className="ghost-action"
                        onClick={() => setKeyPoolDraft((current) => normalizeDefaultRunningHubKeyPoolDraft(current, item.id))}
                      >
                        {item.isDefault ? "默认 Key" : "设为默认"}
                      </button>
                      <button
                        type="button"
                        className="ghost-action"
                        onClick={() => setKeyPoolDraft((current) => current.map((row) => row.id === item.id ? { ...row, enabled: !row.enabled } : row))}
                      >
                        {item.enabled ? "停用" : "启用"}
                      </button>
                      <button type="button" className="ghost-action" onClick={() => void handleDeleteKeyPoolItem(item.id)}>删除</button>
                    </div>
                  </div>
                  <div className="admin-runninghub-analyze-panel__form admin-runninghub-key-pool-row__form">
                    <label>
                      <span>备注</span>
                      <input value={item.note} onChange={(event) => setKeyPoolDraft((current) => current.map((row) => row.id === item.id ? { ...row, note: event.target.value } : row))} />
                    </label>
                    <label>
                      <span>最大并发</span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={item.maxConcurrency}
                        onChange={(event) => setKeyPoolDraft((current) => current.map((row) => row.id === item.id ? { ...row, maxConcurrency: Math.max(1, Number(event.target.value || 1)) } : row))}
                      />
                    </label>
                    <label className="admin-runninghub-analyze-panel__full-row admin-runninghub-key-pool-row__standard-toggle">
                      <span>标准模型 API</span>
                      <span className="admin-runninghub-key-pool-row__standard-control">
                        <input
                          type="checkbox"
                          checked={item.standardModelApi}
                          onChange={(event) => setKeyPoolDraft((current) => current.map((row) => row.id === item.id ? { ...row, standardModelApi: event.target.checked } : row))}
                        />
                        企业级共享 Key
                      </span>
                    </label>
                    <label className="admin-runninghub-analyze-panel__full-row">
                      <span>API Key</span>
                      <input
                        value={item.apiKey || ""}
                        onChange={(event) => setKeyPoolDraft((current) => current.map((row) => row.id === item.id ? { ...row, apiKey: event.target.value } : row))}
                        placeholder={item.apiKeyPreview ? `已保存 (${item.apiKeyPreview})，留空表示不覆盖` : "请输入 API Key"}
                      />
                    </label>
                  </div>
                </div>
              )) : <div className="admin-runninghub-editor__empty-note">当前还没有 RH Key。点击“新增 Key”开始配置号池。</div>}
            </div>
          </div>
        ) : (
          <div className="admin-runninghub-editor__empty-note">默认折叠。展开后可新增、编辑、设为默认、启用、停用和删除单个 RH Key。</div>
        )}
      </section> : null}

      {activeView !== "keys" ? <><div className="admin-runninghub-workspace__sticky-shell">
        <div className="admin-runninghub-workspace__filters">
          <label className="admin-runninghub-workspace__search">
            <Search aria-hidden="true" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、备注、目录 ID" />
          </label>
          {showLocalNavigation ? <div className="admin-runninghub-workspace__tabs" role="tablist" aria-label="RunningHub 分类">
            <button type="button" className={activeTab === "workflow" ? "active" : ""} onClick={() => { setActiveTab("workflow"); onViewChange?.("workflows"); }}>工作流</button>
            <button type="button" className={activeTab === "app" ? "active" : ""} onClick={() => { setActiveTab("app"); onViewChange?.("apps"); }}>AI 应用</button>
          </div> : null}
          <div className="admin-runninghub-workspace__status-filter" role="tablist" aria-label="RunningHub 状态筛选">
            <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>全部</button>
            <button type="button" className={statusFilter === "enabled" ? "active" : ""} onClick={() => setStatusFilter("enabled")}>启用</button>
            <button type="button" className={statusFilter === "disabled" ? "active" : ""} onClick={() => setStatusFilter("disabled")}>停用</button>
          </div>
        </div>
      </div>

      <AdminConfigurationLayout
        className="admin-runninghub-workspace__layout"
        rail={<div className="api-card admin-runninghub-workspace__rail">
          <div className="admin-runninghub-workspace__rail-head">
            <div className="admin-runninghub-workspace__rail-title-row">
              <div className="admin-runninghub-workspace__rail-title-copy">
                <strong>{activeTab === "workflow" ? "工作流目录" : "AI 应用目录"}</strong>
                <span>左侧只负责选条目，右侧统一编辑、测试、保存和删除。</span>
              </div>
              <button type="button" className="admin-runninghub-group-trigger" aria-haspopup="dialog" aria-expanded={groupDrawerOpen} onClick={() => setGroupDrawerOpen(true)}>
                <SlidersHorizontal aria-hidden="true" />
                <span><small>分组筛选</small><strong>{selectedGroupLabel}</strong></span>
                <em>{groupedFilteredItems.length}</em>
              </button>
            </div>
          </div>
          <div className="admin-runninghub-workspace__list-body">
            {groupedFilteredItems.length ? (
              groupedFilteredItems.map((item) => (
                <button
                  key={item.catalogId}
                  type="button"
                  className={selectedCatalogId === item.catalogId ? "admin-runninghub-list-item active" : "admin-runninghub-list-item"}
                  onClick={() => setSelectedCatalogId(item.catalogId)}
                >
                  {(() => {
                    const allowsEmptyInputs = item.allowsEmptyInputs === true;
                    const validFieldCount = Array.isArray(item.fields)
                      ? item.fields.filter((field) => String(field.nodeId || "").trim() && String(field.fieldName || "").trim()).length
                      : 0;
                    const schemaPropertyCount = countSchemaProperties(item.parameterSchema);
                    const summary = `${item.kind === "workflow" ? "工作流" : "AI 应用"} · ${item.taskCapability || "video"} · 绑定 ${validFieldCount} · Schema ${schemaPropertyCount}`;
                    const warning = validFieldCount <= 0
                      ? allowsEmptyInputs
                        ? "显式无入参工作流，可直接启用并运行"
                        : schemaPropertyCount > 0
                          ? "已有结构化参数草案，但仍待补 RH 绑定字段"
                          : "待补输入槽，启用后节点不会展开参数区"
                      : "";
                    return (
                      <>
                        <div className="admin-runninghub-list-item__icon">
                          {item.kind === "workflow" ? <Workflow aria-hidden="true" /> : <Boxes aria-hidden="true" />}
                        </div>
                        <div className="admin-runninghub-list-item__copy">
                          <strong className="admin-runninghub-list-item__title" title={item.title || item.catalogId}>{item.title || item.catalogId}</strong>
                          <span className="admin-runninghub-list-item__note" title={item.note?.trim() || "未补充备注"}>{item.note?.trim() || "未补充备注"}</span>
                          <small className="admin-runninghub-list-item__summary" title={summary}>{summary}</small>
                          {warning ? <small className="admin-runninghub-list-item__warning text-amber-300" title={warning}>{warning}</small> : null}
                          <div className="admin-runninghub-list-item__footer">
                            <em>{item.enabled ? "启用" : "停用"}</em>
                            <small title={item.providerName}>{item.providerName}</small>
                          </div>
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
        </div>}
      >

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
            groups={groups}
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
            {analyzeHint ? <div className="admin-runninghub-analyze-panel__hint">{analyzeHint}</div> : null}
            {analyzeDraft ? (
              <div className="admin-runninghub-analyze-panel__cards">
                <div className="admin-runninghub-analyze-panel__summary">{analyzeDraft.summary}</div>
                {analyzeDraftDrift.length ? (
                  <div className="admin-runninghub-analyze-panel__warnings">
                    {analyzeDraftDrift.map((warning, index) => <span key={`drift-${warning}-${index}`}>漂移提示: {warning}</span>)}
                  </div>
                ) : null}
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
                          onClick={() => void handleCreate(analyzeTargetKind, undefined, buildCreatePayloadFromDraft(selectedProviderId || selectedItem?.providerId || "runninghub", analyzeTargetKind, section))}
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
                    onClick={() => void handleCreate(analyzeTargetKind, undefined, mergeDraftSectionsToCreatePayload(selectedProviderId || selectedItem?.providerId || "runninghub", analyzeTargetKind, analyzeDraft.sections))}
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
      </AdminConfigurationLayout>
      {groupDrawerOpen ? <>
        <div className="admin-runninghub-group-drawer__backdrop" aria-hidden="true" onMouseDown={() => setGroupDrawerOpen(false)} />
        <aside
          className="admin-runninghub-group-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="RunningHub 分组筛选"
          tabIndex={-1}
          onKeyDown={(event) => { if (event.key === "Escape") setGroupDrawerOpen(false); }}
        >
          <AdminRunningHubGroupManager
            groups={groups}
            items={scopedItems}
            selectedGroupId={selectedGroupId}
            onSelect={selectGroup}
            onCreate={() => void handleCreateGroup()}
            onDelete={(group) => void handleDeleteGroup(group)}
            onToggle={(group) => void handleToggleGroup(group)}
            onClose={() => setGroupDrawerOpen(false)}
          />
        </aside>
      </> : null}
      </> : null}
    </AdminConfigurationWorkbench>
  );
}
