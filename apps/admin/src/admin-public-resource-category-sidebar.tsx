import { FolderPlus, Image as ImageIcon, Library, Music, Video } from "lucide-react";
import { AdminBandTabButton } from "./admin-common-components";
import type { ResourceCategory, ResourceKind } from "./admin-types";

export const PUBLIC_RESOURCE_KIND_META: Record<ResourceKind, { label: string; icon: typeof ImageIcon }> = {
  image: { label: "图像", icon: ImageIcon },
  video: { label: "视频", icon: Video },
  audio: { label: "音频", icon: Music },
  set: { label: "素材集", icon: Library },
  pose: { label: "姿势", icon: Library },
  workflow: { label: "工作流", icon: Library },
};

type AdminPublicResourceCategorySidebarProps = {
  kind: ResourceKind;
  categories: ResourceCategory[];
  activeCategoryId: string;
  itemCount: number;
  loading: boolean;
  onSelectCategory: (categoryId: string) => void;
  onSelectKind: (kind: ResourceKind) => void;
  onCreateCategory: () => void;
  onRenameCategory: (category: ResourceCategory) => void;
  onDeleteCategory: (category: ResourceCategory) => void;
};

export function AdminPublicResourceCategorySidebar({
  kind,
  categories,
  activeCategoryId,
  itemCount,
  loading,
  onSelectCategory,
  onSelectKind,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: AdminPublicResourceCategorySidebarProps) {
  return (
    <aside
      className="data-panel admin-public-resources-sidebar admin-public-resources-sidebar--starlight"
      data-governance-surface="resource-directory"
    >
      <div className="admin-public-resources-sidebar__types" data-resource-directory="type-selector" aria-label="资源类型">
        {(Object.keys(PUBLIC_RESOURCE_KIND_META) as ResourceKind[]).map((nextKind) => {
          const Icon = PUBLIC_RESOURCE_KIND_META[nextKind].icon;
          return (
            <AdminBandTabButton key={nextKind} active={kind === nextKind} onClick={() => onSelectKind(nextKind)}>
              <Icon aria-hidden="true" />
              <span>
                <strong>{PUBLIC_RESOURCE_KIND_META[nextKind].label}</strong>
                <small>{nextKind}</small>
              </span>
            </AdminBandTabButton>
          );
        })}
      </div>
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
          <span className="admin-public-resources-category-card__name">全部资源</span>
          <strong>{itemCount}</strong>
        </button>

        {categories.map((category) => (
          <section
            key={category.id}
            className={`admin-public-resources-category-card${activeCategoryId === category.id ? " active" : ""}`}
          >
            <button type="button" className="admin-public-resources-category-card__select" onClick={() => onSelectCategory(category.id)}>
              <span className="admin-public-resources-category-card__name">{category.name}</span>
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
