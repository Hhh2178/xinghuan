import { FolderPlus } from "lucide-react";
import type { ResourceCategory } from "./admin-types";

type AdminPublicResourceCategorySidebarProps = {
  categories: ResourceCategory[];
  activeCategoryId: string;
  itemCount: number;
  loading: boolean;
  onSelectCategory: (categoryId: string) => void;
  onCreateCategory: () => void;
  onRenameCategory: (category: ResourceCategory) => void;
  onDeleteCategory: (category: ResourceCategory) => void;
};

export function AdminPublicResourceCategorySidebar({
  categories,
  activeCategoryId,
  itemCount,
  loading,
  onSelectCategory,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: AdminPublicResourceCategorySidebarProps) {
  return (
    <aside className="data-panel admin-public-resources-sidebar">
      <header>
        <div className="admin-public-resources-sidebar__title">
          <FolderPlus aria-hidden="true" />
          <div>
            <h2>分类</h2>
            <span>{loading ? "同步中" : `${categories.length} 个分类`}</span>
          </div>
        </div>
        <button type="button" onClick={onCreateCategory}>
          新增
        </button>
      </header>

      <div className="admin-public-resources-category-list">
        <button
          type="button"
          className={activeCategoryId === "all" ? "active" : ""}
          onClick={() => onSelectCategory("all")}
        >
          <span>全部资源</span>
          <strong>{itemCount}</strong>
        </button>

        {categories.map((category) => (
          <section
            key={category.id}
            className={`admin-public-resources-category-card${activeCategoryId === category.id ? " active" : ""}`}
          >
            <button type="button" className="admin-public-resources-category-card__select" onClick={() => onSelectCategory(category.id)}>
              <span>{category.name}</span>
              <small>{category.kind}</small>
            </button>
            <div className="admin-public-resources-category-card__actions">
              <button type="button" onClick={() => onRenameCategory(category)}>
                改名
              </button>
              <button type="button" className="danger-button" onClick={() => onDeleteCategory(category)}>
                删除
              </button>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
