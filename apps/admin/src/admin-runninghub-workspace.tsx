import { useEffect, useMemo, useState } from "react";
import { Boxes, RefreshCw, Workflow } from "lucide-react";
import { adminRunningHubApi } from "./admin-api-client";
import { AdminRunningHubItemEditor } from "./admin-runninghub-item-editor";
import type { RunningHubAdminItem } from "./admin-types";

type RunningHubWorkspaceTab = "workflow" | "app";

export function AdminRunningHubWorkspace() {
  const [items, setItems] = useState<RunningHubAdminItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<RunningHubWorkspaceTab>("workflow");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");

  async function loadItems() {
    setBusy(true);
    setError("");
    try {
      const nextItems = await adminRunningHubApi.listItems();
      setItems(nextItems);
      if (!nextItems.some((item) => item.catalogId === selectedCatalogId)) {
        const fallback = nextItems.find((item) => item.kind === (activeTab === "workflow" ? "workflow" : "app"));
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
  }, []);

  const filteredItems = useMemo(
    () => items.filter((item) => item.kind === (activeTab === "workflow" ? "workflow" : "app")),
    [activeTab, items],
  );

  useEffect(() => {
    if (!filteredItems.some((item) => item.catalogId === selectedCatalogId)) {
      setSelectedCatalogId(filteredItems[0]?.catalogId || "");
    }
  }, [filteredItems, selectedCatalogId]);

  const selectedItem = filteredItems.find((item) => item.catalogId === selectedCatalogId) || null;
  const workflowCount = items.filter((item) => item.kind === "workflow").length;
  const appCount = items.filter((item) => item.kind === "app").length;

  return (
    <section className="admin-runninghub-workspace">
      <div className="admin-runninghub-workspace__hero">
        <div className="admin-runninghub-workspace__hero-copy">
          <span>RunningHub Provider Workspace</span>
          <h2>RunningHub 工作台</h2>
          <p>将工作流和 AI 应用从 Provider 表单里拆出来，统一在这里查看目录、切换条目并进入后续结构化编辑。</p>
        </div>
        <button type="button" className="ghost-action" onClick={() => void loadItems()} disabled={busy}>
          <RefreshCw aria-hidden="true" className={busy ? "spin" : ""} /> 刷新目录
        </button>
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

      <div className="admin-runninghub-workspace__tabs" role="tablist" aria-label="RunningHub 分类">
        <button
          type="button"
          className={activeTab === "workflow" ? "active" : ""}
          onClick={() => setActiveTab("workflow")}
        >
          工作流
        </button>
        <button
          type="button"
          className={activeTab === "app" ? "active" : ""}
          onClick={() => setActiveTab("app")}
        >
          AI 应用
        </button>
      </div>

      <div className="admin-runninghub-workspace__layout">
        <section className="api-card admin-runninghub-workspace__list">
          <div className="admin-runninghub-workspace__section-head">
            <strong>{activeTab === "workflow" ? "工作流目录" : "AI 应用目录"}</strong>
            <span>{filteredItems.length} 个条目</span>
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
                  <div>
                    <strong>{item.title || item.catalogId}</strong>
                    <span>{item.providerName}</span>
                  </div>
                  <small>{item.enabled ? "启用中" : "已停用"}</small>
                </button>
              ))
            ) : (
              <div className="empty-models">当前分类暂无条目</div>
            )}
          </div>
        </section>

        <AdminRunningHubItemEditor item={selectedItem} />
      </div>
    </section>
  );
}
