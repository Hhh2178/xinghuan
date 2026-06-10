# Assistant UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 AI 助手相关的后台配置输入异常、前台助手布局与上下文问题、以及后台多余助手入口问题，并确保本地与灰度验收链路可重复执行。

**Architecture:** 后台助手设置页改为“本地草稿态 + 明确保存”，避免每次输入都触发 PATCH。前台助手继续复用公共设置接口，但补齐可缩放布局、会话上下文和空占位过滤。后台保留右侧助手抽屉，移除顶栏重复入口，仅使用侧栏页签和右侧抽屉开关。

**Tech Stack:** React 19, Vite, Node single-port API, contract verification scripts, in-app browser QA

---

### Task 1: 固化当前问题与契约缺口

**Files:**
- Modify: `scripts/verify-admin-assistant-ui-contract.mjs`
- Modify: `scripts/verify-canvas-assistant-ui-contract.mjs`
- Create: `scripts/verify-admin-assistant-settings-save-contract.mjs`

- [ ] **Step 1: 写第一个失败契约，约束后台助手设置页不能边输边自动保存**

```js
// scripts/verify-admin-assistant-settings-save-contract.mjs
import { readFile } from "node:fs/promises";

async function main() {
  const settingsPanel = await readFile(
    new URL("../apps/admin/src/admin-assistant-settings-panel.tsx", import.meta.url),
    "utf8",
  );

  const checks = [
    [
      "Assistant settings panel keeps local draft state instead of saving on every keystroke",
      settingsPanel.includes("useState") &&
        settingsPanel.includes("setDraft") &&
        !settingsPanel.includes('onChange={(event) => void onSave('),
    ],
    [
      "Assistant settings panel exposes explicit save action",
      settingsPanel.includes("保存 AI 助手配置"),
    ],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 2: 运行失败契约，确认它当前是红的**

Run: `node scripts/verify-admin-assistant-settings-save-contract.mjs`
Expected: FAIL，说明当前页面仍在按击键自动保存。

- [ ] **Step 3: 扩展现有助手契约，补齐这轮行为要求**

```js
// scripts/verify-admin-assistant-ui-contract.mjs
[
  "Admin topbar no longer renders duplicate AI toggle button",
  !mainSource.includes('title={assistantOpen ? "收起 AI 助手" : "展开 AI 助手"}'),
],
[
  "Assistant settings page renders explicit save workflow",
  settingsSource.includes("assistant-settings-actions") &&
    settingsSource.includes("保存 AI 助手配置"),
],
```

```js
// scripts/verify-canvas-assistant-ui-contract.mjs
[
  "Canvas assistant supports resizable panel shell",
  assistantSource.includes("canvas-assistant-panel__resize") &&
    styleSource.includes("resize: both;"),
],
[
  "Canvas assistant filters empty media placeholders before creating attachments",
  assistantSource.includes("item.url") &&
    assistantSource.includes("if (!item.url) return"),
],
```

- [ ] **Step 4: 再次运行契约，保留红测**

Run:
- `npm run verify:admin-assistant-ui-contract`
- `npm run verify:canvas-assistant-ui-contract`

Expected: 至少一项 FAIL，证明当前行为还没满足新要求。

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-admin-assistant-settings-save-contract.mjs scripts/verify-admin-assistant-ui-contract.mjs scripts/verify-canvas-assistant-ui-contract.mjs
git commit -m "test: add assistant ui regression contracts"
```

### Task 2: 修复后台助手设置输入异常与重复入口

**Files:**
- Modify: `apps/admin/src/admin-assistant-settings-panel.tsx`
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: 将设置页改成本地 draft 状态组件**

```tsx
const [draft, setDraft] = useState(settings);

useEffect(() => {
  setDraft(settings);
}, [settings]);

function patchFrontend<K extends keyof AssistantSettings["frontend"]>(
  key: K,
  value: AssistantSettings["frontend"][K],
) {
  setDraft((current) => ({
    ...current,
    frontend: { ...current.frontend, [key]: value },
    updatedAt: Date.now(),
  }));
}
```

- [ ] **Step 2: 先不实现保存，只把全部输入从直接 `onSave(...)` 改为更新 draft**

```tsx
<textarea
  value={draft.frontend.hint}
  onChange={(event) => patchFrontend("hint", event.target.value)}
/>
```

- [ ] **Step 3: 运行后台保存契约，确认仍然失败在“无保存动作”或样式项上**

Run: `node scripts/verify-admin-assistant-settings-save-contract.mjs`
Expected: 第一项 PASS，第二项或后续项仍 FAIL。

- [ ] **Step 4: 补明确保存和重置动作**

```tsx
<div className="assistant-settings-actions">
  <button type="button" onClick={() => setDraft(settings)}>
    重置未保存修改
  </button>
  <button
    type="button"
    className="primary-action"
    disabled={saving}
    onClick={() => void onSave(draft)}
  >
    {saving ? "保存中..." : "保存 AI 助手配置"}
  </button>
</div>
```

- [ ] **Step 5: 从后台顶栏移除重复的 AI 助手按钮，只保留右侧抽屉和侧栏页签**

```tsx
// apps/admin/src/main.tsx
<div className="topbar-actions">
  {busy ? <Loader2 className="spin" aria-hidden="true" /> : <span className="health-dot">API 已连接</span>}
  <span className="user-chip">
    <UserCog aria-hidden="true" />
    {currentUser.email}
  </span>
  <button type="button" className="icon-button" onClick={handleLogout} title="退出登录">
    <LogOut aria-hidden="true" />
  </button>
</div>
```

- [ ] **Step 6: 让右侧抽屉自身保留开关按钮和页签语义**

```tsx
<button type="button" className="admin-assistant-dock__toggle" onClick={onToggle} title={open ? "收起 AI 助手" : "展开 AI 助手"}>
```

- [ ] **Step 7: 补样式，保证设置页可编辑区和按钮区稳定**

```css
.assistant-settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.assistant-settings-actions .primary-action {
  min-width: 148px;
}
```

- [ ] **Step 8: 运行契约确认转绿**

Run:
- `node scripts/verify-admin-assistant-settings-save-contract.mjs`
- `npm run verify:admin-assistant-ui-contract`

Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/admin-assistant-settings-panel.tsx apps/admin/src/main.tsx apps/admin/src/styles.css
git commit -m "fix: stabilize assistant settings editing flow"
```

### Task 3: 修复前台助手占位、布局与上下文

**Files:**
- Modify: `apps/web/src/components/CanvasAssistant.tsx`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/src/services/api.ts`

- [ ] **Step 1: 为前台助手附件构造加空值过滤红测**

```js
[
  "Canvas assistant filters empty media placeholders before creating attachments",
  assistantSource.includes("if (!item.url) return"),
],
```

- [ ] **Step 2: 过滤空媒体占位，避免界面出现空白卡片**

```tsx
images.slice(0, 3).forEach((item, index) => {
  if (!item.url) return;
  results.push({
    id: `${node.id}-image-${index}`,
    kind: "image",
    title: item.name || "图片素材",
    summary: item.url,
    payload: { nodeId: node.id, url: item.url, kind: "image" },
  });
});
```

- [ ] **Step 3: 把助手面板改为可缩放、可滚动、不会文字溢出的容器**

```tsx
<section className="canvas-assistant-panel" ...>
  <div className="canvas-assistant-panel__resize" aria-hidden="true" />
```

```css
.canvas-assistant-panel {
  width: min(420px, calc(100vw - 24px));
  min-width: 320px;
  min-height: 360px;
  max-width: min(720px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  resize: both;
  overflow: hidden;
}

.canvas-assistant-panel__messages {
  overflow: auto;
  min-height: 0;
}

.canvas-assistant-message p,
.assistant-process-list pre {
  overflow-wrap: anywhere;
  word-break: break-word;
}
```

- [ ] **Step 4: 保持前端会话上下文，不在每次开关时重置消息**

```tsx
// do not call resetSession on open/close toggle
// only clear on explicit resetSession()
```

- [ ] **Step 5: 如果公共设置接口缺字段映射，补注释或类型保护，不暴露后台字段**

```ts
export interface PublicAssistantSettings {
  frontend: { ... };
  integration: { ... };
  updatedAt: number;
}
```

- [ ] **Step 6: 运行前台契约**

Run: `npm run verify:canvas-assistant-ui-contract`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/CanvasAssistant.tsx apps/web/src/styles/index.css apps/web/src/services/api.ts
git commit -m "fix: improve canvas assistant layout and context"
```

### Task 4: 浏览器与本地单端口验收

**Files:**
- Verify only

- [ ] **Step 1: 运行现有后台/前台助手契约**

Run:
- `npm run verify:admin-assistant-ui-contract`
- `npm run verify:admin-assistant-chat`
- `npm run verify:canvas-assistant-ui-contract`
- `npm run verify:canvas-assistant-chat`

Expected: PASS。

- [ ] **Step 2: 用本地浏览器复验登录页、后台设置页和前台助手**

Run:
- 打开 `http://127.0.0.1:18200/`
- 确认登录页邮箱为空
- 进入后台确认仅保留右侧助手抽屉，不再有顶栏重复按钮
- 在“AI 助手设置”页输入欢迎语，确认不再边输边报错
- 在前台选中含空媒体占位节点，确认不再出现空白附件卡片
- 拖动并缩放前台助手，确认文本不溢出

- [ ] **Step 3: 更新日志**

Files:
- Modify: `DEVLOG.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `docs/prd/v0.1.0/changelog.md`

- [ ] **Step 4: Commit**

```bash
git add DEVLOG.md docs/prd/v0.1.0/progress.md docs/prd/v0.1.0/changelog.md
git commit -m "docs: record assistant ui fixes"
```
