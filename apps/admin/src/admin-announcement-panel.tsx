import { Bell, Megaphone, Pin, Plus, Save, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AnnouncementPriority,
  AnnouncementScope,
  AnnouncementStatus,
  AnnouncementType,
} from "@xinghuan/shared";
import type {
  AdminAnnouncementRecord,
  AdminAnnouncementUpsertPayload,
} from "./admin-types";

type EditorState = {
  title: string;
  summary: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  scope: AnnouncementScope;
  pinned: boolean;
  strongReminder: boolean;
  popupEnabled: boolean;
  versionTag: string;
  publishedAt: string;
  expireAt: string;
};

const DEFAULT_EDITOR_STATE: EditorState = {
  title: "",
  summary: "",
  content: "",
  type: "manual",
  priority: "normal",
  status: "draft",
  scope: "all-users",
  pinned: false,
  strongReminder: false,
  popupEnabled: false,
  versionTag: "",
  publishedAt: "",
  expireAt: "",
};

const NEW_ANNOUNCEMENT_ID = "__new_announcement__";

function toLocalInputValue(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  if (!value.trim()) return undefined;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : undefined;
}

function createEditorState(record?: AdminAnnouncementRecord | null): EditorState {
  if (!record) return { ...DEFAULT_EDITOR_STATE };
  return {
    title: record.title,
    summary: record.summary,
    content: record.content,
    type: record.type,
    priority: record.priority,
    status: record.status,
    scope: record.scope,
    pinned: record.pinned,
    strongReminder: record.strongReminder,
    popupEnabled: record.popupEnabled,
    versionTag: record.versionTag || "",
    publishedAt: toLocalInputValue(record.publishedAt),
    expireAt: toLocalInputValue(record.expireAt),
  };
}

function buildPayload(state: EditorState): AdminAnnouncementUpsertPayload {
  return {
    title: state.title.trim(),
    summary: state.summary.trim(),
    content: state.content.trim(),
    type: state.type,
    priority: state.priority,
    status: state.status,
    scope: state.scope,
    pinned: state.pinned,
    strongReminder: state.strongReminder,
    popupEnabled: state.popupEnabled,
    versionTag: state.versionTag.trim(),
    publishedAt: fromLocalInputValue(state.publishedAt),
    expireAt: fromLocalInputValue(state.expireAt),
  };
}

function statusLabel(status: AnnouncementStatus) {
  return status === "published" ? "已发布" : status === "archived" ? "已归档" : "草稿";
}

function priorityLabel(priority: AnnouncementPriority) {
  return priority === "strong-reminder" ? "强提醒" : priority === "important" ? "重要" : "普通";
}

function scopeLabel(scope: AnnouncementScope) {
  return scope === "admins-only" ? "仅管理员" : "全体用户";
}

function formatTime(value?: number) {
  if (!value) return "未设置";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AdminAnnouncementPanel({
  items,
  loading,
  busy,
  onReload,
  onCreate,
  onUpdate,
  onPublish,
  onArchive,
  onDelete,
}: {
  items: AdminAnnouncementRecord[];
  loading: boolean;
  busy: boolean;
  onReload: () => Promise<void> | void;
  onCreate: (payload: AdminAnnouncementUpsertPayload) => Promise<void> | void;
  onUpdate: (id: string, payload: AdminAnnouncementUpsertPayload) => Promise<void> | void;
  onPublish: (
    id: string,
    payload: { confirmTitle: string; confirmStrongReminder: boolean; confirmPinned: boolean },
  ) => Promise<void> | void;
  onArchive: (id: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [editor, setEditor] = useState<EditorState>(DEFAULT_EDITOR_STATE);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const selectedItem = useMemo(
    () => (selectedId === NEW_ANNOUNCEMENT_ID ? null : items.find((item) => item.id === selectedId) || null),
    [items, selectedId],
  );

  useEffect(() => {
    if (!items.length) {
      setSelectedId("");
      setEditor({ ...DEFAULT_EDITOR_STATE });
      return;
    }
    if (
      selectedId !== NEW_ANNOUNCEMENT_ID &&
      (!selectedId || !items.some((item) => item.id === selectedId))
    ) {
      setSelectedId(items[0].id);
      setEditor(createEditorState(items[0]));
    }
  }, [items, selectedId]);

  useEffect(() => {
    setEditor(createEditorState(selectedItem));
  }, [selectedItem]);

  const canSave = editor.title.trim() && editor.summary.trim() && editor.content.trim();
  const isNewDraft = !selectedItem;
  const publishScopeLabel = scopeLabel(editor.scope);

  async function handleSave() {
    if (!canSave) return;
    const payload = buildPayload(editor);
    if (selectedItem) {
      await onUpdate(selectedItem.id, payload);
      return;
    }
    await onCreate(payload);
  }

  async function handleCreateNew() {
    setSelectedId(NEW_ANNOUNCEMENT_ID);
    setPublishDialogOpen(false);
    setEditor({ ...DEFAULT_EDITOR_STATE });
  }

  return (
    <section className="admin-announcement-page data-panel">
      <header className="admin-announcement-hero">
        <div>
          <p className="admin-announcement-hero__eyebrow">Announcement Center</p>
          <strong>公告中心</strong>
          <p>统一维护草稿、版本通知和强提醒公告，前台抽屉与即时弹层都从这里发出。</p>
        </div>
        <div className="admin-announcement-hero__actions">
          <span>{items.length} 条公告</span>
          <button type="button" onClick={handleCreateNew} disabled={busy}>
            <Plus aria-hidden="true" />
            新建公告
          </button>
          <button type="button" onClick={() => void onReload()} disabled={busy || loading}>
            <Bell aria-hidden="true" />
            刷新
          </button>
        </div>
      </header>

      <div className="admin-announcement-shell">
        <aside className="admin-announcement-list">
          <div className="admin-announcement-list__header">
            <strong>公告列表</strong>
            <span>{loading ? "加载中..." : "按发布时间倒序"}</span>
          </div>
          <div className="admin-announcement-list__body">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === selectedId ? "admin-announcement-row active" : "admin-announcement-row"}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="admin-announcement-row__title">
                    <strong>{item.title || "未命名公告"}</strong>
                    <span>{statusLabel(item.status)}</span>
                  </div>
                  <p>{item.summary || "暂无摘要"}</p>
                  <div className="admin-announcement-row__meta">
                    <span>{priorityLabel(item.priority)}</span>
                    <span>{scopeLabel(item.scope)}</span>
                    <span>{formatTime(item.publishedAt || item.updatedAt)}</span>
                  </div>
                  <div className="admin-announcement-row__chips">
                    {item.pinned ? (
                      <span>
                        <Pin aria-hidden="true" />
                        置顶
                      </span>
                    ) : null}
                    {item.strongReminder ? (
                      <span>
                        <Megaphone aria-hidden="true" />
                        强提醒
                      </span>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="admin-announcement-empty">
                <Bell aria-hidden="true" />
                <span>当前还没有公告，先创建第一条草稿。</span>
              </div>
            )}
          </div>
        </aside>

        <section className="admin-announcement-editor">
          <div className="admin-announcement-editor__header">
            <div>
              <strong>{isNewDraft ? "新公告草稿" : selectedItem?.title || "编辑公告"}</strong>
              <span>关闭前记得保存。强提醒发布后会通过 SSE 触发前台即时弹层。</span>
            </div>
            {!isNewDraft ? (
              <div className="admin-announcement-editor__status">
                <span>{statusLabel(selectedItem?.status || "draft")}</span>
                <span>{priorityLabel(selectedItem?.priority || "normal")}</span>
              </div>
            ) : null}
          </div>

          <div className="admin-announcement-form-grid">
            <label className="admin-announcement-field admin-announcement-field--span-2">
              <span>标题</span>
              <input
                value={editor.title}
                onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
                placeholder="例如：灰度发布提醒 / 节点能力更新"
              />
            </label>

            <label className="admin-announcement-field admin-announcement-field--span-2">
              <span>摘要</span>
              <input
                value={editor.summary}
                onChange={(event) => setEditor((current) => ({ ...current, summary: event.target.value }))}
                placeholder="前台列表中优先展示的短摘要"
              />
            </label>

            <label className="admin-announcement-field admin-announcement-field--span-2">
              <span>正文</span>
              <textarea
                value={editor.content}
                onChange={(event) => setEditor((current) => ({ ...current, content: event.target.value }))}
                placeholder="支持多段说明。强提醒建议首段写清影响范围和建议动作。"
              />
            </label>

            <label className="admin-announcement-field">
              <span>类型</span>
              <select
                value={editor.type}
                onChange={(event) => setEditor((current) => ({ ...current, type: event.target.value as AnnouncementType }))}
              >
                <option value="manual">手动公告</option>
                <option value="release-note">版本公告</option>
                <option value="system">系统公告</option>
              </select>
            </label>

            <label className="admin-announcement-field">
              <span>优先级</span>
              <select
                value={editor.priority}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, priority: event.target.value as AnnouncementPriority }))
                }
              >
                <option value="normal">普通</option>
                <option value="important">重要</option>
                <option value="strong-reminder">强提醒</option>
              </select>
            </label>

            <label className="admin-announcement-field">
              <span>范围</span>
              <select
                value={editor.scope}
                onChange={(event) => setEditor((current) => ({ ...current, scope: event.target.value as AnnouncementScope }))}
              >
                <option value="all-users">全体用户</option>
                <option value="admins-only">仅管理员</option>
              </select>
            </label>

            <label className="admin-announcement-field">
              <span>状态</span>
              <select
                value={editor.status}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, status: event.target.value as AnnouncementStatus }))
                }
              >
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="archived">已归档</option>
              </select>
            </label>

            <label className="admin-announcement-field">
              <span>发布时间</span>
              <input
                type="datetime-local"
                value={editor.publishedAt}
                onChange={(event) => setEditor((current) => ({ ...current, publishedAt: event.target.value }))}
              />
            </label>

            <label className="admin-announcement-field">
              <span>下线时间</span>
              <input
                type="datetime-local"
                value={editor.expireAt}
                onChange={(event) => setEditor((current) => ({ ...current, expireAt: event.target.value }))}
              />
            </label>

            <label className="admin-announcement-field">
              <span>版本号</span>
              <input
                value={editor.versionTag}
                onChange={(event) => setEditor((current) => ({ ...current, versionTag: event.target.value }))}
                placeholder="例如 v0.5.1"
              />
            </label>
          </div>

          <div className="admin-announcement-toggles">
            <label>
              <input
                type="checkbox"
                checked={editor.pinned}
                onChange={(event) => setEditor((current) => ({ ...current, pinned: event.target.checked }))}
              />
              <span>置顶公告</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={editor.strongReminder}
                onChange={(event) => setEditor((current) => ({ ...current, strongReminder: event.target.checked }))}
              />
              <span>强提醒</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={editor.popupEnabled}
                onChange={(event) => setEditor((current) => ({ ...current, popupEnabled: event.target.checked }))}
              />
              <span>允许前台弹窗</span>
            </label>
          </div>

          <div className="admin-announcement-editor__actions">
            <button type="button" onClick={() => void handleSave()} disabled={busy || !canSave}>
              <Save aria-hidden="true" />
              {selectedItem ? "保存更新" : "创建草稿"}
            </button>

            {selectedItem ? (
              <>
                <button
                  type="button"
                  className="warning"
                  onClick={() => setPublishDialogOpen(true)}
                  disabled={busy}
                >
                  <Send aria-hidden="true" />
                  发布公告
                </button>
                <button
                  type="button"
                  className="muted"
                  onClick={() => void onArchive(selectedItem.id)}
                  disabled={busy}
                >
                  归档
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void onDelete(selectedItem.id)}
                  disabled={busy}
                >
                  <Trash2 aria-hidden="true" />
                  删除
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>

      {publishDialogOpen && selectedItem ? (
        <div className="admin-announcement-modal-backdrop">
          <section className="admin-announcement-modal">
            <header>
              <strong>发布确认</strong>
              <span>{`将向 ${publishScopeLabel} 发布强提醒公告：${editor.title || selectedItem.title}`}</span>
            </header>
            <div className="admin-announcement-modal__summary">
              <div>
                <span>标题</span>
                <strong>{editor.title || selectedItem.title}</strong>
              </div>
              <div>
                <span>强提醒</span>
                <strong>{editor.strongReminder ? "是" : "否"}</strong>
              </div>
              <div>
                <span>置顶</span>
                <strong>{editor.pinned ? "是" : "否"}</strong>
              </div>
            </div>
            <footer>
              <button type="button" className="muted" onClick={() => setPublishDialogOpen(false)} disabled={busy}>
                取消
              </button>
              <button
                type="button"
                className="warning"
                disabled={busy}
                onClick={async () => {
                  await onPublish(selectedItem.id, {
                    confirmTitle: editor.title || selectedItem.title,
                    confirmStrongReminder: editor.strongReminder,
                    confirmPinned: editor.pinned,
                  });
                  setPublishDialogOpen(false);
                }}
              >
                <Send aria-hidden="true" />
                确认发布
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
