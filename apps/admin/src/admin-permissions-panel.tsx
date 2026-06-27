import { useMemo, useState } from "react";
import { FolderTree, Network, RefreshCw, Search, Workflow } from "lucide-react";
import { AdminPermissionsGroupRail } from "./admin-permissions-group-rail";
import { AdminPermissionsSavebar } from "./admin-permissions-savebar";
import { AdminPermissionsSummaryStrip } from "./admin-permissions-summary-strip";
import { StatusPill } from "./admin-common-components";
import type {
  AdminGroupPermissionPolicy,
  AdminPermissionCatalog,
  AdminUserGroup,
  GroupPermissionDeny,
  PermissionNodeType,
  ResourceCategory,
  RunningHubAdminItem,
  SharedResourceItem,
} from "./admin-types";

type PermissionSection = "shared-resources" | "runninghub-apps" | "runninghub-workflows" | "node-types";

const SECTION_OPTIONS: Array<{ id: PermissionSection; label: string }> = [
  { id: "shared-resources", label: "公共资源" },
  { id: "runninghub-apps", label: "RH AI 应用" },
  { id: "runninghub-workflows", label: "RH 工作流" },
  { id: "node-types", label: "节点能力" },
];

const SECTION_DETAILS: Record<
  PermissionSection,
  {
    label: string;
    title: string;
    description: string;
    bulkLabel: string;
    emptyLabel: string;
    scopeNote: string;
  }
> = {
  "shared-resources": {
    label: "公共资源",
    title: "公共素材可见范围",
    description: "分类禁用会整体隐藏该分类下的素材；条目禁用用于做更细粒度的开放控制。",
    bulkLabel: "当前筛选会影响分类与素材条目两层对象。",
    emptyLabel: "当前筛选下没有可配置的公共资源。",
    scopeNote: "前台成员只会看到当前分组被开放的分类和素材。",
  },
  "runninghub-apps": {
    label: "RH AI 应用",
    title: "AI 应用开放范围",
    description: "这里控制普通成员是否能在前台看到并使用对应 RH AI 应用。",
    bulkLabel: "当前筛选会直接影响应用目录显示。",
    emptyLabel: "当前筛选下没有可配置的 RH AI 应用。",
    scopeNote: "被禁用的应用会从普通成员界面直接隐藏。",
  },
  "runninghub-workflows": {
    label: "RH 工作流",
    title: "工作流开放范围",
    description: "用于限制哪些 RH 工作流可以被当前分组成员看到、选择和运行。",
    bulkLabel: "当前筛选会直接影响工作流目录显示。",
    emptyLabel: "当前筛选下没有可配置的 RH 工作流。",
    scopeNote: "被禁用的工作流会从普通成员界面直接隐藏。",
  },
  "node-types": {
    label: "节点能力",
    title: "节点能力开放范围",
    description: "节点禁用后，普通成员无法在画布中创建和使用该类能力节点。",
    bulkLabel: "当前筛选会直接影响节点创建入口。",
    emptyLabel: "当前筛选下没有可配置的节点能力。",
    scopeNote: "被禁用的节点类型会从普通成员的节点面板里移除。",
  },
};

function emptyDeny(): GroupPermissionDeny {
  return {
    sharedResourceCategoryIds: [],
    sharedResourceItemIds: [],
    runningHubAppCatalogIds: [],
    runningHubWorkflowCatalogIds: [],
    nodeTypes: [],
  };
}

function normalizeIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function normalizeDeny(deny?: GroupPermissionDeny): GroupPermissionDeny {
  const base = deny || emptyDeny();
  return {
    sharedResourceCategoryIds: normalizeIds(base.sharedResourceCategoryIds || []),
    sharedResourceItemIds: normalizeIds(base.sharedResourceItemIds || []),
    runningHubAppCatalogIds: normalizeIds(base.runningHubAppCatalogIds || []),
    runningHubWorkflowCatalogIds: normalizeIds(base.runningHubWorkflowCatalogIds || []),
    nodeTypes: normalizeIds(base.nodeTypes || []),
  };
}

function denyEquals(left?: GroupPermissionDeny, right?: GroupPermissionDeny) {
  return JSON.stringify(normalizeDeny(left)) === JSON.stringify(normalizeDeny(right));
}

function containsText(haystack: Array<string | number | undefined>, keyword: string) {
  if (!keyword) return true;
  const merged = haystack.filter(Boolean).join(" ").toLowerCase();
  return merged.includes(keyword.toLowerCase());
}

function resourceKindLabel(kind: string) {
  return (
    {
      image: "图像",
      video: "视频",
      audio: "音频",
      set: "素材集",
      pose: "姿势",
      workflow: "工作流",
    } as Record<string, string>
  )[kind] || kind;
}

function runningHubKindLabel(kind: "app" | "workflow") {
  return kind === "app" ? "AI 应用" : "工作流";
}

function formatUpdatedAt(value?: number) {
  return value ? new Date(value).toLocaleString() : "未单独保存";
}

function sectionDenyKey(section: PermissionSection): keyof GroupPermissionDeny {
  if (section === "shared-resources") return "sharedResourceItemIds";
  if (section === "runninghub-apps") return "runningHubAppCatalogIds";
  if (section === "runninghub-workflows") return "runningHubWorkflowCatalogIds";
  return "nodeTypes";
}

function PermissionToggle({
  denied,
  onToggle,
}: {
  denied: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={denied ? "permission-toggle permission-toggle--denied" : "permission-toggle permission-toggle--allowed"}
      onClick={onToggle}
      aria-pressed={denied}
    >
      <span className="permission-toggle__track">
        <span className="permission-toggle__thumb" />
      </span>
      <span>{denied ? "禁用" : "允许"}</span>
    </button>
  );
}

export function AdminPermissionsPanel({
  catalog,
  policies,
  loading,
  error,
  onReload,
  onSavePolicy,
}: {
  catalog: AdminPermissionCatalog | null;
  policies: AdminGroupPermissionPolicy[];
  loading: boolean;
  error: string;
  onReload: () => void;
  onSavePolicy: (groupId: string, deny: GroupPermissionDeny) => Promise<void>;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState("ungrouped");
  const [activeSection, setActiveSection] = useState<PermissionSection>("shared-resources");
  const [groupSearch, setGroupSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, GroupPermissionDeny>>({});
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  const groups = useMemo(() => {
    const source = catalog?.userGroups || [];
    return [...source].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-CN"));
  }, [catalog]);

  const policyMap = useMemo(() => {
    const next = new Map<string, AdminGroupPermissionPolicy>();
    for (const policy of policies) next.set(policy.groupId, policy);
    return next;
  }, [policies]);

  const visibleGroups = useMemo(
    () => groups.filter((group) => containsText([group.name, group.description, group.id], groupSearch)),
    [groupSearch, groups],
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || visibleGroups[0] || groups[0] || null,
    [groups, selectedGroupId, visibleGroups],
  );

  const selectedPolicy = selectedGroup ? policyMap.get(selectedGroup.id) : undefined;
  const currentDeny = normalizeDeny(drafts[selectedGroup?.id || ""] || selectedPolicy?.deny);
  const persistedDeny = normalizeDeny(selectedPolicy?.deny);
  const dirty = !denyEquals(currentDeny, persistedDeny);

  const categoryMap = useMemo(
    () => new Map((catalog?.sharedResourceCategories || []).map((category) => [category.id, category])),
    [catalog],
  );

  const sharedCategories = useMemo(
    () =>
      (catalog?.sharedResourceCategories || []).filter((category) =>
        containsText([category.name, category.kind, category.id], contentSearch),
      ),
    [catalog, contentSearch],
  );

  const sharedItems = useMemo(
    () =>
      (catalog?.sharedResourceItems || []).filter((item) =>
        containsText(
          [item.title, item.kind, item.id, item.tags.join(" "), categoryMap.get(item.categoryId || "")?.name],
          contentSearch,
        ),
      ),
    [catalog, categoryMap, contentSearch],
  );

  const runningHubApps = useMemo(
    () =>
      (catalog?.runningHubApps || []).filter((item) =>
        containsText([item.title, item.providerName, item.catalogId, item.appId, item.runTargetId], contentSearch),
      ),
    [catalog, contentSearch],
  );

  const runningHubWorkflows = useMemo(
    () =>
      (catalog?.runningHubWorkflows || []).filter((item) =>
        containsText([item.title, item.providerName, item.catalogId, item.workflowId, item.runTargetId], contentSearch),
      ),
    [catalog, contentSearch],
  );

  const nodeTypes = useMemo(
    () =>
      (catalog?.nodeTypes || []).filter((item) =>
        containsText([item.label, item.group, item.description, item.id], contentSearch),
      ),
    [catalog, contentSearch],
  );

  const sharedCategoryCountById = useMemo(() => {
    const next = new Map<string, number>();
    for (const item of catalog?.sharedResourceItems || []) {
      if (!item.categoryId) continue;
      next.set(item.categoryId, (next.get(item.categoryId) || 0) + 1);
    }
    return next;
  }, [catalog]);

  const missingIds = useMemo(() => {
    const knownIds = {
      sharedResourceCategoryIds: new Set((catalog?.sharedResourceCategories || []).map((item) => item.id)),
      sharedResourceItemIds: new Set((catalog?.sharedResourceItems || []).map((item) => item.id)),
      runningHubAppCatalogIds: new Set((catalog?.runningHubApps || []).map((item) => item.catalogId)),
      runningHubWorkflowCatalogIds: new Set((catalog?.runningHubWorkflows || []).map((item) => item.catalogId)),
      nodeTypes: new Set((catalog?.nodeTypes || []).map((item) => item.id)),
    };
    return {
      sharedResourceCategoryIds: currentDeny.sharedResourceCategoryIds.filter((id) => !knownIds.sharedResourceCategoryIds.has(id)),
      sharedResourceItemIds: currentDeny.sharedResourceItemIds.filter((id) => !knownIds.sharedResourceItemIds.has(id)),
      runningHubAppCatalogIds: currentDeny.runningHubAppCatalogIds.filter((id) => !knownIds.runningHubAppCatalogIds.has(id)),
      runningHubWorkflowCatalogIds: currentDeny.runningHubWorkflowCatalogIds.filter((id) => !knownIds.runningHubWorkflowCatalogIds.has(id)),
      nodeTypes: currentDeny.nodeTypes.filter((id) => !knownIds.nodeTypes.has(id)),
    };
  }, [catalog, currentDeny]);

  function ensureSelectedGroupDraft() {
    if (!selectedGroup) return emptyDeny();
    const existing = drafts[selectedGroup.id];
    if (existing) return normalizeDeny(existing);
    return normalizeDeny(selectedPolicy?.deny);
  }

  function updateDraft(nextDeny: GroupPermissionDeny) {
    if (!selectedGroup) return;
    setDrafts((current) => ({ ...current, [selectedGroup.id]: normalizeDeny(nextDeny) }));
  }

  function toggleId(key: keyof GroupPermissionDeny, id: string) {
    const base = ensureSelectedGroupDraft();
    const currentIds = new Set(base[key]);
    if (currentIds.has(id)) currentIds.delete(id);
    else currentIds.add(id);
    updateDraft({ ...base, [key]: Array.from(currentIds) });
  }

  function setBulkState(key: keyof GroupPermissionDeny, ids: string[], denied: boolean) {
    const base = ensureSelectedGroupDraft();
    const currentIds = new Set(base[key]);
    for (const id of ids) {
      if (denied) currentIds.add(id);
      else currentIds.delete(id);
    }
    updateDraft({ ...base, [key]: Array.from(currentIds) });
  }

  async function handleSave() {
    if (!selectedGroup || !dirty) return;
    setSaving(true);
    setLocalError("");
    try {
      await onSavePolicy(selectedGroup.id, currentDeny);
      setDrafts((current) => ({ ...current, [selectedGroup.id]: normalizeDeny(currentDeny) }));
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  const visibleIds = useMemo(() => {
    if (activeSection === "shared-resources") {
      return {
        primary: sharedItems.map((item) => item.id),
        secondary: sharedCategories.map((category) => category.id),
      };
    }
    if (activeSection === "runninghub-apps") return { primary: runningHubApps.map((item) => item.catalogId), secondary: [] as string[] };
    if (activeSection === "runninghub-workflows") return { primary: runningHubWorkflows.map((item) => item.catalogId), secondary: [] as string[] };
    return { primary: nodeTypes.map((item) => item.id), secondary: [] as string[] };
  }, [activeSection, nodeTypes, runningHubApps, runningHubWorkflows, sharedCategories, sharedItems]);

  const effectiveGroup = selectedGroup || null;
  const activeSectionDetail = SECTION_DETAILS[activeSection];
  const deniedTotal =
    currentDeny.sharedResourceCategoryIds.length +
    currentDeny.sharedResourceItemIds.length +
    currentDeny.runningHubAppCatalogIds.length +
    currentDeny.runningHubWorkflowCatalogIds.length +
    currentDeny.nodeTypes.length;
  const visiblePrimaryCount = visibleIds.primary.length;
  const visiblePrimaryDeniedCount = visibleIds.primary.filter((id) => currentDeny[sectionDenyKey(activeSection)].includes(id)).length;
  const visibleSecondaryDeniedCount =
    activeSection === "shared-resources"
      ? visibleIds.secondary.filter((id) => currentDeny.sharedResourceCategoryIds.includes(id)).length
      : 0;
  const missingCurrentCount =
    activeSection === "shared-resources"
      ? missingIds.sharedResourceCategoryIds.length + missingIds.sharedResourceItemIds.length
      : activeSection === "runninghub-apps"
        ? missingIds.runningHubAppCatalogIds.length
        : activeSection === "runninghub-workflows"
          ? missingIds.runningHubWorkflowCatalogIds.length
          : missingIds.nodeTypes.length;

  return (
    <section className="permissions-shell permissions-shell--starlight">
      <AdminPermissionsGroupRail
        groups={visibleGroups as AdminUserGroup[]}
        groupSearch={groupSearch}
        onGroupSearchChange={setGroupSearch}
        selectedGroupId={effectiveGroup?.id || null}
        onSelectGroup={setSelectedGroupId}
        policyMap={policyMap}
        summarizeDeny={normalizeDeny}
      />

      <section className="panel-stack permissions-editor">
        <div className="api-card permissions-hero">
          <div className="permissions-hero__copy">
            <span className="permissions-hero__eyebrow">权限策略工作台</span>
            <strong>{effectiveGroup?.name || "请选择分组"}</strong>
            <p>
              未开放的公共资源、RH 应用、工作流和节点能力会直接从普通成员界面隐藏，只在后端保留兜底校验。
            </p>
            <div className="permission-row__chips">
              <span>{effectiveGroup?.description || "当前分组暂无说明"}</span>
              <span>最近保存 {formatUpdatedAt(selectedPolicy?.updatedAt)}</span>
              {selectedPolicy?.updatedBy ? <span>更新人 {selectedPolicy.updatedBy}</span> : null}
            </div>
          </div>
          <div className="permissions-hero__actions">
            <button type="button" className="icon-button" onClick={onReload} title="刷新权限目录">
              <RefreshCw aria-hidden="true" />
              <span>刷新</span>
            </button>
            {loading ? <StatusPill tone="warning">同步中</StatusPill> : <StatusPill tone="success">目录已就绪</StatusPill>}
          </div>
        </div>

        <AdminPermissionsSummaryStrip
          groupName={effectiveGroup?.name || "-"}
          memberCount={selectedPolicy?.memberCount || 0}
          deniedSharedResources={currentDeny.sharedResourceCategoryIds.length + currentDeny.sharedResourceItemIds.length}
          deniedRunningHubApps={currentDeny.runningHubAppCatalogIds.length}
          deniedRunningHubWorkflows={currentDeny.runningHubWorkflowCatalogIds.length}
          deniedNodeTypes={currentDeny.nodeTypes.length}
        />

        <div className="permissions-impact-panel">
          <div className="permissions-impact-panel__card">
            <span>当前筛选可配置条目</span>
            <strong>{visiblePrimaryCount}</strong>
            <small>{activeSectionDetail.label}</small>
          </div>
          <div className="permissions-impact-panel__card">
            <span>当前视图已禁用</span>
            <strong>{visiblePrimaryDeniedCount + visibleSecondaryDeniedCount}</strong>
            <small>
              {activeSection === "shared-resources"
                ? `分类 ${visibleSecondaryDeniedCount} / 条目 ${visiblePrimaryDeniedCount}`
                : "仅统计当前筛选范围"}
            </small>
          </div>
          <div className="permissions-impact-panel__card">
            <span>当前分组总限制</span>
            <strong>{deniedTotal}</strong>
            <small>跨全部目录累计</small>
          </div>
          <div className="permissions-impact-panel__card">
            <span>目录缺失限制项</span>
            <strong>{missingCurrentCount}</strong>
            <small>继续保留，不会被静默放开</small>
          </div>
        </div>

        <div className="permissions-section-tabs">
          {SECTION_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={activeSection === option.id ? "active" : ""}
              onClick={() => setActiveSection(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="data-panel permissions-content-panel">
          <header>
            {activeSection === "shared-resources" ? <FolderTree aria-hidden="true" /> : activeSection === "node-types" ? <Network aria-hidden="true" /> : <Workflow aria-hidden="true" />}
            <h2>{activeSectionDetail.label}</h2>
          </header>

          <div className="permissions-section-overview">
            <div className="permissions-section-overview__copy">
              <span>{activeSectionDetail.title}</span>
              <strong>{activeSectionDetail.description}</strong>
              <p>{activeSectionDetail.scopeNote}</p>
            </div>
            <div className="permissions-section-overview__stats">
              <div>
                <span>当前列表</span>
                <strong>{visiblePrimaryCount}</strong>
              </div>
              <div>
                <span>已禁用</span>
                <strong>{visiblePrimaryDeniedCount + visibleSecondaryDeniedCount}</strong>
              </div>
              <div>
                <span>保留项</span>
                <strong>{missingCurrentCount}</strong>
              </div>
            </div>
          </div>

          <div className="permissions-toolbar">
            <label className="toolbar-search permissions-search">
              <Search aria-hidden="true" />
              <input
                placeholder="搜索当前列表"
                value={contentSearch}
                onChange={(event) => setContentSearch(event.target.value)}
              />
            </label>
            <div className="permissions-toolbar__actions">
              <div className="permissions-toolbar__action-copy">
                <strong>批量操作</strong>
                <span>{activeSectionDetail.bulkLabel}</span>
              </div>
              {activeSection === "shared-resources" ? (
                <>
                  <button type="button" onClick={() => setBulkState("sharedResourceCategoryIds", visibleIds.secondary, false)}>当前分类全部允许</button>
                  <button type="button" onClick={() => setBulkState("sharedResourceCategoryIds", visibleIds.secondary, true)}>当前分类全部禁用</button>
                </>
              ) : null}
              <button type="button" onClick={() => setBulkState(sectionDenyKey(activeSection), visibleIds.primary, false)}>当前筛选全部允许</button>
              <button type="button" onClick={() => setBulkState(sectionDenyKey(activeSection), visibleIds.primary, true)}>当前筛选全部禁用</button>
            </div>
          </div>

          {error || localError ? <div className="form-error permissions-error">{localError || error}</div> : null}

          <div className="permissions-content">
            {activeSection === "shared-resources" ? (
              <>
                <section className="permission-section-block">
                  <div className="permission-section-block__head">
                    <strong>资源分类</strong>
                    <span>{sharedCategories.length} 个</span>
                  </div>
                  <div className="permission-resource-list">
                    {sharedCategories.map((category) => {
                      const denied = currentDeny.sharedResourceCategoryIds.includes(category.id);
                      return (
                        <div className="permission-row" key={category.id}>
                          <div className="permission-row__body">
                            <div className="permission-row__title">
                              <strong>{category.name}</strong>
                              <div className="permission-row__chips">
                                <span>{resourceKindLabel(category.kind)}</span>
                                <span>{sharedCategoryCountById.get(category.id) || 0} 个素材</span>
                              </div>
                            </div>
                            <p>{category.id}</p>
                          </div>
                          <PermissionToggle denied={denied} onToggle={() => toggleId("sharedResourceCategoryIds", category.id)} />
                        </div>
                      );
                    })}
                    {!sharedCategories.length ? <div className="permissions-empty-card">当前筛选下没有匹配的资源分类。</div> : null}
                  </div>
                </section>

                <section className="permission-section-block">
                  <div className="permission-section-block__head">
                    <strong>资源条目</strong>
                    <span>{sharedItems.length} 个</span>
                  </div>
                  <div className="permission-resource-list">
                    {sharedItems.map((item) => {
                      const denied = currentDeny.sharedResourceItemIds.includes(item.id);
                      const category = categoryMap.get(item.categoryId || "");
                      return (
                        <SharedResourcePermissionRow
                          key={item.id}
                          item={item}
                          category={category}
                          denied={denied}
                          categoryDenied={Boolean(item.categoryId && currentDeny.sharedResourceCategoryIds.includes(item.categoryId))}
                          onToggle={() => toggleId("sharedResourceItemIds", item.id)}
                        />
                      );
                    })}
                    {!sharedItems.length ? <div className="permissions-empty-card">当前筛选下没有匹配的资源条目。</div> : null}
                  </div>
                </section>
              </>
            ) : null}

            {activeSection === "runninghub-apps" ? (
              <div className="permission-card-grid">
                {runningHubApps.map((item) => (
                  <RunningHubPermissionCard
                    key={item.catalogId}
                    item={item}
                    denied={currentDeny.runningHubAppCatalogIds.includes(item.catalogId)}
                    onToggle={() => toggleId("runningHubAppCatalogIds", item.catalogId)}
                  />
                ))}
              </div>
            ) : null}

            {activeSection === "runninghub-workflows" ? (
              <div className="permission-card-grid">
                {runningHubWorkflows.map((item) => (
                  <RunningHubPermissionCard
                    key={item.catalogId}
                    item={item}
                    denied={currentDeny.runningHubWorkflowCatalogIds.includes(item.catalogId)}
                    onToggle={() => toggleId("runningHubWorkflowCatalogIds", item.catalogId)}
                  />
                ))}
              </div>
            ) : null}

            {activeSection === "node-types" ? (
              <div className="permission-card-grid">
                {nodeTypes.map((item) => (
                  <NodePermissionCard
                    key={item.id}
                    item={item}
                    denied={currentDeny.nodeTypes.includes(item.id)}
                    onToggle={() => toggleId("nodeTypes", item.id)}
                  />
                ))}
              </div>
            ) : null}

            {activeSection !== "shared-resources" && !visibleIds.primary.length ? (
              <div className="permissions-empty-card">{activeSectionDetail.emptyLabel}</div>
            ) : null}
          </div>

          <MissingPermissionBlock activeSection={activeSection} missingIds={missingIds} />

          <AdminPermissionsSavebar
            dirty={dirty}
            saving={saving}
            hasSelectedGroup={Boolean(effectiveGroup)}
            updatedAt={selectedPolicy?.updatedAt}
            onReset={() => updateDraft(persistedDeny)}
            onSave={handleSave}
          />
        </div>
      </section>
    </section>
  );
}

function SharedResourcePermissionRow({
  item,
  category,
  denied,
  categoryDenied,
  onToggle,
}: {
  item: SharedResourceItem;
  category?: ResourceCategory;
  denied: boolean;
  categoryDenied: boolean;
  onToggle: () => void;
}) {
  const previewUrl = item.fileUrl || item.url || "";
  const isImage = String(item.mime || "").startsWith("image/");
  return (
    <div className="permission-row">
      <div className="permission-row__media">
        {previewUrl && isImage ? <img src={previewUrl} alt={item.title} /> : <span>{resourceKindLabel(item.kind)}</span>}
      </div>
      <div className="permission-row__body">
        <div className="permission-row__title">
          <strong>{item.title}</strong>
          <div className="permission-row__chips">
            <span>{resourceKindLabel(item.kind)}</span>
            {category ? <span>{category.name}</span> : null}
            {categoryDenied ? <span className="warning">分类已禁用</span> : null}
          </div>
        </div>
        <p>{item.id}</p>
      </div>
      <PermissionToggle denied={denied} onToggle={onToggle} />
    </div>
  );
}

function RunningHubPermissionCard({
  item,
  denied,
  onToggle,
}: {
  item: RunningHubAdminItem;
  denied: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="permission-card">
      <div className="permission-card__media">
        {item.thumbnail ? <img src={item.thumbnail} alt={item.title} /> : <span>{runningHubKindLabel(item.kind || "app")}</span>}
      </div>
      <div className="permission-card__body">
        <div className="permission-card__title">
          <strong>{item.title}</strong>
          <StatusPill tone={denied ? "danger" : "success"}>{denied ? "已禁用" : "允许"}</StatusPill>
        </div>
        <p>{item.providerName}</p>
        <div className="permission-row__chips">
          <span>{runningHubKindLabel(item.kind || "app")}</span>
          {item.runTargetId ? <span>{item.runTargetId}</span> : null}
          {item.fields?.length ? <span>{item.fields.length} 个输入槽</span> : null}
        </div>
        <div className="permission-card__meta-grid">
          <div>
            <span>目录 ID</span>
            <code>{item.catalogId}</code>
          </div>
          <div>
            <span>运行目标</span>
            <code>{item.runTargetId || "未配置"}</code>
          </div>
        </div>
        <div className="permission-card__footer">
          <PermissionToggle denied={denied} onToggle={onToggle} />
        </div>
      </div>
    </div>
  );
}

function NodePermissionCard({
  item,
  denied,
  onToggle,
}: {
  item: PermissionNodeType;
  denied: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="permission-card">
      <div className="permission-card__media permission-card__media--icon">
        <Network aria-hidden="true" />
      </div>
      <div className="permission-card__body">
        <div className="permission-card__title">
          <strong>{item.label}</strong>
          <StatusPill tone={denied ? "danger" : "success"}>{denied ? "已禁用" : "允许"}</StatusPill>
        </div>
        <p>{item.description || "当前节点能力用于控制成员是否能创建和运行对应节点。"}</p>
        <div className="permission-card__meta-grid">
          <div>
            <span>节点分组</span>
            <code>{item.group}</code>
          </div>
          <div>
            <span>节点 ID</span>
            <code>{item.id}</code>
          </div>
        </div>
        <div className="permission-card__footer">
          <PermissionToggle denied={denied} onToggle={onToggle} />
        </div>
      </div>
    </div>
  );
}

function MissingPermissionBlock({
  activeSection,
  missingIds,
}: {
  activeSection: PermissionSection;
  missingIds: Record<keyof GroupPermissionDeny, string[]>;
}) {
  const current =
    activeSection === "shared-resources"
      ? [...missingIds.sharedResourceCategoryIds, ...missingIds.sharedResourceItemIds]
      : activeSection === "runninghub-apps"
        ? missingIds.runningHubAppCatalogIds
        : activeSection === "runninghub-workflows"
          ? missingIds.runningHubWorkflowCatalogIds
          : missingIds.nodeTypes;
  if (!current.length) return null;
  return (
    <div className="permissions-missing-block">
      <strong>以下限制项暂时不在当前目录中</strong>
      <p>它们会继续保留在策略里，避免目录临时缺失时权限被误放开。</p>
      <div className="permission-row__chips">
        {current.map((id) => (
          <span key={id}>{id}</span>
        ))}
      </div>
    </div>
  );
}
