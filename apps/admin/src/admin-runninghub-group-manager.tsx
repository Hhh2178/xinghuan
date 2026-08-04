import { FolderPlus, Power, Trash2, X } from "lucide-react";
import type { RunningHubAdminItem, RunningHubGroup } from "./admin-types";

export function AdminRunningHubGroupManager({
  groups,
  items,
  selectedGroupId,
  onSelect,
  onCreate,
  onDelete,
  onToggle,
  onClose,
}: {
  groups: RunningHubGroup[];
  items: RunningHubAdminItem[];
  selectedGroupId: string;
  onSelect: (groupId: string) => void;
  onCreate: () => void;
  onDelete: (group: RunningHubGroup) => void;
  onToggle: (group: RunningHubGroup) => void;
  onClose?: () => void;
}) {
  const countFor = (groupId: string) => items.filter((item) => item.groupId === groupId).length;
  return <div className="admin-runninghub-group-manager" aria-label="RunningHub 分组管理">
    <div className="admin-runninghub-group-manager__head">
      <div className="admin-runninghub-group-manager__copy"><strong>分组筛选</strong><span>分组权限先于条目权限生效</span></div>
      <div className="admin-runninghub-group-manager__head-actions">
        <button type="button" className="admin-runninghub-group-manager__create" onClick={onCreate}><FolderPlus aria-hidden="true" />新建分组</button>
        {onClose ? <button type="button" className="admin-runninghub-group-manager__close" title="关闭分组筛选" aria-label="关闭分组筛选" onClick={onClose}><X aria-hidden="true" /></button> : null}
      </div>
    </div>
    <div className="admin-runninghub-group-manager__list">
      <button type="button" className={selectedGroupId === "" ? "admin-runninghub-group-manager__item active" : "admin-runninghub-group-manager__item"} onClick={() => onSelect("")}>
        <span className="admin-runninghub-group-manager__item-label"><span className="admin-runninghub-group-manager__status-dot" />全部条目</span><em>{items.length}</em>
      </button>
    {groups.map((group) => <div key={group.id} className="admin-runninghub-group-manager__row">
      <button type="button" className={selectedGroupId === group.id ? "admin-runninghub-group-manager__item active" : "admin-runninghub-group-manager__item"} onClick={() => onSelect(group.id)}>
        <span className="admin-runninghub-group-manager__item-label"><span className={group.enabled ? "admin-runninghub-group-manager__status-dot enabled" : "admin-runninghub-group-manager__status-dot disabled"} />{group.name}</span><em>{countFor(group.id)}</em>
      </button>
      <div className="admin-runninghub-group-manager__actions">
        <button type="button" className="admin-runninghub-group-manager__icon" title={group.enabled ? "停用分组" : "启用分组"} aria-label={group.enabled ? `停用分组 ${group.name}` : `启用分组 ${group.name}`} onClick={() => onToggle(group)}><Power aria-hidden="true" /></button>
        <button type="button" className="admin-runninghub-group-manager__icon danger-button" title="删除分组" aria-label={`删除分组 ${group.name}`} onClick={() => onDelete(group)}><Trash2 aria-hidden="true" /></button>
      </div>
    </div>)}
      <button type="button" className={selectedGroupId === "ungrouped" ? "admin-runninghub-group-manager__item active" : "admin-runninghub-group-manager__item"} onClick={() => onSelect("ungrouped")}>
        <span className="admin-runninghub-group-manager__item-label"><span className="admin-runninghub-group-manager__status-dot ungrouped" />未分组</span><em>{items.filter((item) => !item.groupId).length}</em>
      </button>
    </div>
  </div>;
}
