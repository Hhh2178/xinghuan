export function AdminPermissionsSavebar({
  dirty,
  saving,
  hasSelectedGroup,
  updatedAt,
  onReset,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  hasSelectedGroup: boolean;
  updatedAt?: number;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="permissions-savebar">
      <div>
        <strong>{dirty ? "有未保存的权限调整" : "当前分组权限已同步"}</strong>
        <span>
          {updatedAt ? `最近更新：${new Date(updatedAt).toLocaleString()}` : "当前分组还没有独立的限制记录。"}
        </span>
      </div>
      <div className="permissions-savebar__actions">
        <button type="button" className="muted-button" disabled={!dirty || saving} onClick={onReset}>
          放弃修改
        </button>
        <button type="button" disabled={!dirty || saving || !hasSelectedGroup} onClick={onSave}>
          {saving ? "保存中..." : "保存权限"}
        </button>
      </div>
    </div>
  );
}
