import { FolderPlus, Trash2 } from "lucide-react";
import type { RunningHubAdminItem, RunningHubGroup } from "./admin-types";

export function AdminRunningHubGroupManager({
  groups,
  items,
  selectedGroupId,
  onSelect,
  onCreate,
  onDelete,
  onToggle,
}: {
  groups: RunningHubGroup[];
  items: RunningHubAdminItem[];
  selectedGroupId: string;
  onSelect: (groupId: string) => void;
  onCreate: () => void;
  onDelete: (group: RunningHubGroup) => void;
  onToggle: (group: RunningHubGroup) => void;
}) {
  const countFor = (groupId: string) => items.filter((item) => item.groupId === groupId).length;
  return <div className="admin-runninghub-group-manager" aria-label="RunningHub 分组管理">
    <div className="admin-runninghub-group-manager__head">
      <div><strong>分组</strong><span>分组权限先于条目权限生效</span></div>
      <button type="button" className="ghost-action" onClick={onCreate}><FolderPlus aria-hidden="true" />新建分组</button>
    </div>
    <button type="button" className={selectedGroupId === "" ? "admin-runninghub-group-manager__item active" : "admin-runninghub-group-manager__item"} onClick={() => onSelect("")}>全部条目 <em>{items.length}</em></button>
    {groups.map((group) => <div key={group.id} className="admin-runninghub-group-manager__row">
      <button type="button" className={selectedGroupId === group.id ? "admin-runninghub-group-manager__item active" : "admin-runninghub-group-manager__item"} onClick={() => onSelect(group.id)}>
        <span>{group.name}{group.enabled ? "" : " · 已停用"}</span><em>{countFor(group.id)}</em>
      </button>
      <button type="button" className="admin-runninghub-group-manager__icon" title={group.enabled ? "停用分组" : "启用分组"} onClick={() => onToggle(group)}>{group.enabled ? "停用" : "启用"}</button>
      <button type="button" className="admin-runninghub-group-manager__icon danger-button" title="删除分组" onClick={() => onDelete(group)}><Trash2 aria-hidden="true" /></button>
    </div>)}
    <button type="button" className={selectedGroupId === "ungrouped" ? "admin-runninghub-group-manager__item active" : "admin-runninghub-group-manager__item"} onClick={() => onSelect("ungrouped")}>未分组 <em>{items.filter((item) => !item.groupId).length}</em></button>
  </div>;
}
