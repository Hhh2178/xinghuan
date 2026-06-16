# Generation Library Material Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image/video preview and download to the generation library while introducing a reusable backend material-access layer that this release uses only for generation-library items.

**Architecture:** Keep the existing generation-library ledger and TTL unchanged, but move access behavior behind a small API service layer. The API will enrich generation-library items with `previewUrl`/`downloadUrl` metadata and expose a unified content route for `inline` vs `attachment`. The web drawer will add a preview overlay and consume only the new access fields for preview/download behavior.

**Tech Stack:** Node.js HTTP server, TypeScript, React, existing web component patterns, local contract verification scripts, CodeGraph-aware repo conventions

---

## File Structure

### Backend

- Create: `apps/api/src/material-access-types.ts`
  - Stable type definitions for material source, disposition, descriptor, and resolved file access
- Create: `apps/api/src/material-access-service.ts`
  - Generation-library-specific access resolution and descriptor builders, structured so resource-library/task-output can reuse later
- Modify: `apps/api/src/server.ts`
  - Wire new service into generation-library item list responses
  - Add content route for generation-library material preview/download
  - Keep routing logic thin and delegate file resolution to the new service

### Frontend

- Modify: `apps/web/src/services/api.ts`
  - Extend `GenerationLibraryItem` to include access metadata
- Create: `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`
  - Drawer-local preview overlay for image/video preview, next/prev navigation, and download action
- Modify: `apps/web/src/components/GenerationLibraryDrawer.tsx`
  - Add preview/download actions and hook overlay state to the enriched API fields

### Verification

- Create: `scripts/verify-generation-library-material-access-contract.mjs`
  - Backend contract checks for new access service wiring and route presence
- Create: `scripts/verify-generation-library-preview-contract.mjs`
  - Frontend contract checks for preview overlay wiring and card actions
- Modify: `scripts/verify-generation-library-and-admin-assistant-layout.mjs`
  - Extend the existing generation-library contract with new access metadata expectations if that is the local convention

### Docs

- Modify: `DEVLOG.md`
  - Record implementation and validation
- Modify: `MEMORY.md`
  - Add the new generation-library material access capability as current structure knowledge

---

### Task 1: Add backend material-access type definitions

**Files:**
- Create: `apps/api/src/material-access-types.ts`
- Test: `scripts/verify-generation-library-material-access-contract.mjs`

- [ ] **Step 1: Write the failing contract check for the new types module**

```javascript
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const typesPath = join(root, "apps", "api", "src", "material-access-types.ts");
const source = existsSync(typesPath) ? readFileSync(typesPath, "utf8") : "";

assert.equal(existsSync(typesPath), true, "material-access-types.ts should exist");
assert.match(source, /export type MaterialSource = "generation-library"/, "MaterialSource should include generation-library");
assert.match(source, /export type MaterialAccessDisposition = "inline" \| "attachment"/, "disposition type should cover preview and download");
assert.match(source, /export interface MaterialAccessDescriptor/, "descriptor type should exist");
assert.match(source, /previewUrl:/, "descriptor should include previewUrl");
assert.match(source, /downloadUrl:/, "descriptor should include downloadUrl");
assert.match(source, /filename:/, "descriptor should include filename");
```

- [ ] **Step 2: Run the contract check to verify it fails**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: FAIL because `apps/api/src/material-access-types.ts` does not exist yet.

- [ ] **Step 3: Create the types module with the minimal stable definitions**

```typescript
export type MaterialSource = "generation-library";

export type MaterialAccessDisposition = "inline" | "attachment";

export interface MaterialAccessDescriptor {
  source: MaterialSource;
  materialId: string;
  filename: string;
  mime: string;
  size: number;
  previewUrl: string;
  downloadUrl: string;
  openUrl: string;
  canDownload: boolean;
  isExpired: boolean;
}

export interface ResolvedMaterialAccess {
  source: MaterialSource;
  materialId: string;
  filename: string;
  mime: string;
  size: number;
  absolutePath: string;
  isExpired: boolean;
}
```

- [ ] **Step 4: Run the contract check to verify it passes**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: PASS for the types module assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/material-access-types.ts scripts/verify-generation-library-material-access-contract.mjs
git commit -m "feat: add material access type definitions"
```

### Task 2: Implement generation-library material-access service

**Files:**
- Create: `apps/api/src/material-access-service.ts`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-generation-library-material-access-contract.mjs`

- [ ] **Step 1: Extend the failing contract check to require the service boundary**

```javascript
const servicePath = join(root, "apps", "api", "src", "material-access-service.ts");
const serviceSource = existsSync(servicePath) ? readFileSync(servicePath, "utf8") : "";

assert.equal(existsSync(servicePath), true, "material-access-service.ts should exist");
assert.match(serviceSource, /createMaterialAccessService/, "service factory should exist");
assert.match(serviceSource, /resolveGenerationLibraryMaterial/, "service should resolve generation-library items");
assert.match(serviceSource, /buildGenerationLibraryAccessDescriptor/, "service should build response descriptors");
assert.match(serviceSource, /disposition=inline/, "service should build inline preview urls");
assert.match(serviceSource, /disposition=attachment/, "service should build download urls");
```

- [ ] **Step 2: Run the contract check to verify it fails**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: FAIL because the service module does not exist yet.

- [ ] **Step 3: Create the material-access service**

```typescript
import { basename, join } from "node:path";
import type { MaterialAccessDescriptor, ResolvedMaterialAccess } from "./material-access-types.js";

export function createMaterialAccessService(deps: {
  safeText: (value: unknown, fallback?: string) => string;
  inferMime: (filename: string) => string;
  requestPublicOrigin: (request: import("node:http").IncomingMessage) => string;
  userDataDirs: (user: { id: string }) => { outputDir: string };
}) {
  function buildGenerationLibraryAccessDescriptor(input: {
    request: import("node:http").IncomingMessage;
    item: {
      id: string;
      fileUrl?: string;
      url?: string;
      mime?: string;
      size?: number;
      expiresAt: number;
      title: string;
    };
  }): MaterialAccessDescriptor {
    const fileUrl = deps.safeText(input.item.fileUrl || input.item.url);
    const filename = buildDownloadFilename(fileUrl, input.item.title);
    const base = deps.requestPublicOrigin(input.request) || "";
    const path = `/api/materials/generation-library/${encodeURIComponent(input.item.id)}/content`;
    const previewUrl = `${base}${path}?disposition=inline`;
    const downloadUrl = `${base}${path}?disposition=attachment`;
    return {
      source: "generation-library",
      materialId: input.item.id,
      filename,
      mime: deps.safeText(input.item.mime, deps.inferMime(filename)),
      size: Number(input.item.size) || 0,
      previewUrl,
      downloadUrl,
      openUrl: previewUrl,
      canDownload: true,
      isExpired: input.item.expiresAt <= Date.now(),
    };
  }

  function resolveGenerationLibraryMaterial(input: {
    item: {
      id: string;
      fileUrl?: string;
      url?: string;
      mime?: string;
      size?: number;
      expiresAt: number;
      title: string;
    };
    user: { id: string };
  }): ResolvedMaterialAccess {
    const fileUrl = deps.safeText(input.item.fileUrl || input.item.url);
    if (!fileUrl.startsWith("/files/output/")) throw new Error("MATERIAL_ACCESS_UNSUPPORTED_URL");
    const fileSegment = decodeURIComponent(fileUrl.slice("/files/output/".length));
    if (!fileSegment || /[\\/]/.test(fileSegment) || fileSegment.includes("..")) {
      throw new Error("MATERIAL_ACCESS_INVALID_PATH");
    }
    const filename = buildDownloadFilename(fileUrl, input.item.title);
    return {
      source: "generation-library",
      materialId: input.item.id,
      filename,
      mime: deps.safeText(input.item.mime, deps.inferMime(filename)),
      size: Number(input.item.size) || 0,
      absolutePath: join(deps.userDataDirs(input.user).outputDir, fileSegment),
      isExpired: input.item.expiresAt <= Date.now(),
    };
  }

  function buildDownloadFilename(fileUrl: string, title: string) {
    const raw = deps.safeText(title, basename(fileUrl));
    return raw.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_") || "material";
  }

  return {
    buildGenerationLibraryAccessDescriptor,
    resolveGenerationLibraryMaterial,
  };
}
```

- [ ] **Step 4: Wire the service import into `server.ts` without changing behavior yet**

```typescript
import { createMaterialAccessService } from "./material-access-service.js";
```

And initialize once near other server helpers:

```typescript
const materialAccessService = createMaterialAccessService({
  safeText,
  inferMime,
  requestPublicOrigin,
  userDataDirs,
});
```

- [ ] **Step 5: Run the contract check to verify it passes**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: PASS for the service boundary assertions.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/material-access-service.ts apps/api/src/material-access-types.ts apps/api/src/server.ts scripts/verify-generation-library-material-access-contract.mjs
git commit -m "feat: add generation library material access service"
```

### Task 3: Enrich generation-library item responses with access metadata

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/web/src/services/api.ts`
- Test: `scripts/verify-generation-library-material-access-contract.mjs`

- [ ] **Step 1: Extend the contract check to require item metadata fields in API and web types**

```javascript
const apiServerPath = join(root, "apps", "api", "src", "server.ts");
const apiServerSource = readFileSync(apiServerPath, "utf8");
const webApiPath = join(root, "apps", "web", "src", "services", "api.ts");
const webApiSource = readFileSync(webApiPath, "utf8");

assert.match(apiServerSource, /previewUrl:/, "server should emit previewUrl");
assert.match(apiServerSource, /downloadUrl:/, "server should emit downloadUrl");
assert.match(apiServerSource, /openUrl:/, "server should emit openUrl");
assert.match(apiServerSource, /canDownload:/, "server should emit canDownload");
assert.match(apiServerSource, /isExpired:/, "server should emit isExpired");

assert.match(webApiSource, /previewUrl\?: string;/, "web GenerationLibraryItem should include previewUrl");
assert.match(webApiSource, /downloadUrl\?: string;/, "web GenerationLibraryItem should include downloadUrl");
assert.match(webApiSource, /openUrl\?: string;/, "web GenerationLibraryItem should include openUrl");
assert.match(webApiSource, /filename\?: string;/, "web GenerationLibraryItem should include filename");
assert.match(webApiSource, /canDownload\?: boolean;/, "web GenerationLibraryItem should include canDownload");
assert.match(webApiSource, /isExpired\?: boolean;/, "web GenerationLibraryItem should include isExpired");
```

- [ ] **Step 2: Run the contract check to verify it fails**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: FAIL because the response metadata is not emitted yet.

- [ ] **Step 3: Extend the web API type**

```typescript
export interface GenerationLibraryItem {
  id: string;
  kind: GenerationLibraryKind;
  title: string;
  url: string;
  fileUrl: string;
  mime?: string;
  size?: number;
  filename?: string;
  previewUrl?: string;
  downloadUrl?: string;
  openUrl?: string;
  canDownload?: boolean;
  isExpired?: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  duplicate?: boolean;
}
```

- [ ] **Step 4: Enrich the generation-library list response in `server.ts`**

Update the `GET /api/generation-library/items` branch so the returned items map through the service:

```typescript
const db = await readGenerationLibraryDb(currentUser!, { cleanup: true });
const items = db.items
  .filter((item) => !kind || item.kind === kind)
  .filter((item) => !q || `${item.title} ${item.mime || ""}`.toLowerCase().includes(q))
  .sort((a, b) => b.updatedAt - a.updatedAt)
  .map((item) => ({
    ...item,
    ...materialAccessService.buildGenerationLibraryAccessDescriptor({
      request,
      item,
    }),
  }));
sendT8(response, items);
```

- [ ] **Step 5: Run the contract check to verify it passes**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: PASS for metadata fields in the API and web contract.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/server.ts apps/web/src/services/api.ts scripts/verify-generation-library-material-access-contract.mjs
git commit -m "feat: enrich generation library items with access metadata"
```

### Task 4: Add the unified content route for generation-library preview and download

**Files:**
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-generation-library-material-access-contract.mjs`

- [ ] **Step 1: Extend the contract check to require the route and `Content-Disposition` handling**

```javascript
assert.match(apiServerSource, /\/api\/materials\/generation-library\/\(\[\^\/\]\+\)\/content/, "server should expose generation-library content route");
assert.match(apiServerSource, /disposition === "attachment"/, "route should branch for attachment downloads");
assert.match(apiServerSource, /Content-Disposition/, "route should set download headers");
assert.match(apiServerSource, /MATERIAL_EXPIRED/, "route should distinguish expired assets");
assert.match(apiServerSource, /MATERIAL_ACCESS_DENIED|AUTH_REQUIRED|MATERIAL_NOT_FOUND/, "route should return explicit access errors");
```

- [ ] **Step 2: Run the contract check to verify it fails**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: FAIL because the content route does not exist yet.

- [ ] **Step 3: Add the route in `server.ts`**

Insert a route branch near other authenticated API routes:

```typescript
const generationLibraryContentMatch = url.pathname.match(/^\/api\/materials\/generation-library\/([^/]+)\/content$/);
if (generationLibraryContentMatch && request.method === "GET") {
  if (!currentUser) throw new HttpError(401, "AUTH_REQUIRED");
  const db = await readGenerationLibraryDb(currentUser, { cleanup: true });
  const itemId = decodeURIComponent(generationLibraryContentMatch[1]);
  const item = db.items.find((entry) => entry.id === itemId);
  if (!item) throw new HttpError(404, "MATERIAL_NOT_FOUND");

  const resolved = materialAccessService.resolveGenerationLibraryMaterial({ item, user: currentUser });
  if (resolved.isExpired) throw new HttpError(410, "MATERIAL_EXPIRED");

  const disposition = safeText(url.searchParams.get("disposition"), "inline") === "attachment" ? "attachment" : "inline";
  const body = await readFile(resolved.absolutePath);
  response.statusCode = 200;
  response.setHeader("content-type", resolved.mime || "application/octet-stream");
  response.setHeader("content-length", String(body.length));
  if (disposition === "attachment") {
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(resolved.filename)}`,
    );
  }
  response.end(body);
  return;
}
```

- [ ] **Step 4: Run the contract check to verify it passes**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: PASS for route presence and header behavior assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts scripts/verify-generation-library-material-access-contract.mjs
git commit -m "feat: add generation library preview and download route"
```

### Task 5: Add the generation-library preview overlay component

**Files:**
- Create: `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`
- Test: `scripts/verify-generation-library-preview-contract.mjs`

- [ ] **Step 1: Write the failing frontend contract check for the overlay component**

```javascript
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const overlayPath = join(root, "apps", "web", "src", "components", "GenerationLibraryPreviewOverlay.tsx");
const overlaySource = existsSync(overlayPath) ? readFileSync(overlayPath, "utf8") : "";

assert.equal(existsSync(overlayPath), true, "GenerationLibraryPreviewOverlay should exist");
assert.match(overlaySource, /export default function GenerationLibraryPreviewOverlay/, "overlay component should be exported");
assert.match(overlaySource, /role="dialog"/, "overlay should expose dialog semantics");
assert.match(overlaySource, /下载/, "overlay should expose a download action");
assert.match(overlaySource, /上一张|上一项/, "overlay should expose previous navigation");
assert.match(overlaySource, /下一张|下一项/, "overlay should expose next navigation");
assert.match(overlaySource, /item\.kind === 'image'/, "overlay should handle image preview");
assert.match(overlaySource, /item\.kind === 'video'/, "overlay should handle video preview");
```

- [ ] **Step 2: Run the contract check to verify it fails**

Run:

```powershell
node scripts/verify-generation-library-preview-contract.mjs
```

Expected: FAIL because the overlay component does not exist yet.

- [ ] **Step 3: Create the preview overlay component**

```tsx
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { GenerationLibraryItem } from "../services/api";
import LoopingVideo from "./LoopingVideo";

interface GenerationLibraryPreviewOverlayProps {
  item: GenerationLibraryItem;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export default function GenerationLibraryPreviewOverlay({
  item,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: GenerationLibraryPreviewOverlayProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="生成素材预览">
      <div className="relative flex h-full max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{item.title}</div>
            <div className="mt-1 text-[11px] text-white/55">{item.filename || item.title}</div>
          </div>
          <div className="flex items-center gap-2">
            {item.downloadUrl && (
              <a
                href={item.downloadUrl}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                <Download size={13} /> 下载
              </a>
            )}
            <button onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-black">
          {hasPrev && (
            <button onClick={onPrev} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white">
              <ChevronLeft size={18} />
            </button>
          )}
          {hasNext && (
            <button onClick={onNext} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white">
              <ChevronRight size={18} />
            </button>
          )}
          <div className="flex h-full w-full items-center justify-center p-4">
            {item.kind === 'image' && (
              <img src={item.previewUrl || item.fileUrl} alt={item.title} className="max-h-full max-w-full object-contain" draggable={false} />
            )}
            {item.kind === 'video' && (
              <LoopingVideo src={item.previewUrl || item.fileUrl} controls className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the contract check to verify it passes**

Run:

```powershell
node scripts/verify-generation-library-preview-contract.mjs
```

Expected: PASS for the overlay contract assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GenerationLibraryPreviewOverlay.tsx scripts/verify-generation-library-preview-contract.mjs
git commit -m "feat: add generation library preview overlay"
```

### Task 6: Wire preview/download actions into the drawer

**Files:**
- Modify: `apps/web/src/components/GenerationLibraryDrawer.tsx`
- Modify: `scripts/verify-generation-library-preview-contract.mjs`

- [ ] **Step 1: Extend the frontend contract check to require drawer wiring**

```javascript
const drawerPath = join(root, "apps", "web", "src", "components", "GenerationLibraryDrawer.tsx");
const drawerSource = readFileSync(drawerPath, "utf8");

assert.match(drawerSource, /from '\.\/GenerationLibraryPreviewOverlay'/, "drawer should import the preview overlay");
assert.match(drawerSource, /const \[previewIndex, setPreviewIndex\]/, "drawer should track preview state");
assert.match(drawerSource, /查看/, "drawer should render a preview action");
assert.match(drawerSource, /下载/, "drawer should render a download action");
assert.match(drawerSource, /item\.previewUrl \|\| item\.fileUrl/, "drawer should prefer previewUrl");
assert.match(drawerSource, /item\.downloadUrl/, "drawer should use downloadUrl");
assert.match(drawerSource, /<GenerationLibraryPreviewOverlay/, "drawer should mount the overlay");
```

- [ ] **Step 2: Run the contract check to verify it fails**

Run:

```powershell
node scripts/verify-generation-library-preview-contract.mjs
```

Expected: FAIL because the drawer does not yet expose the new actions.

- [ ] **Step 3: Update the drawer state and actions**

Add state and helpers:

```tsx
const [previewIndex, setPreviewIndex] = useState<number | null>(null);
const previewableItems = useMemo(
  () => items.filter((item) => item.kind === "image" || item.kind === "video"),
  [items],
);
const activePreviewItem = previewIndex === null ? null : previewableItems[previewIndex] || null;

const openPreview = (item: GenerationLibraryItem) => {
  const index = previewableItems.findIndex((entry) => entry.id === item.id);
  if (index >= 0) setPreviewIndex(index);
};

const closePreview = () => setPreviewIndex(null);
const showPrev = () => setPreviewIndex((current) => current === null ? current : Math.max(0, current - 1));
const showNext = () => setPreviewIndex((current) => current === null ? current : Math.min(previewableItems.length - 1, current + 1));
```

- [ ] **Step 4: Update the card actions**

Replace the action row with:

```tsx
<div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
  {(item.kind === "image" || item.kind === "video") && (
    <button onClick={() => openPreview(item)} className={`${itemBtn} flex items-center gap-1`} title="查看">
      查看
    </button>
  )}
  {item.downloadUrl && item.canDownload !== false && (
    <a href={item.downloadUrl} className={`${itemBtn} flex items-center gap-1`} title="下载">
      下载
    </a>
  )}
  <button onClick={() => insertItem(item)} className={`${itemBtn} flex items-center gap-1`} title="插入画布">
    <Plus size={13} /> 插入
  </button>
  <button onClick={() => deleteItem(item)} className={`${itemBtn} flex items-center gap-1 text-rose-300`} title="删除">
    <Trash2 size={13} /> 删除
  </button>
</div>
```

Also make preview open from the thumbnail container:

```tsx
<div
  className="relative h-28 overflow-hidden bg-black/80"
  onClick={() => (item.kind === "image" || item.kind === "video") && openPreview(item)}
>
```

- [ ] **Step 5: Mount the overlay**

Add near the drawer root end:

```tsx
{activePreviewItem && (
  <GenerationLibraryPreviewOverlay
    item={activePreviewItem}
    hasPrev={previewIndex !== null && previewIndex > 0}
    hasNext={previewIndex !== null && previewIndex < previewableItems.length - 1}
    onPrev={showPrev}
    onNext={showNext}
    onClose={closePreview}
  />
)}
```

- [ ] **Step 6: Run the contract check to verify it passes**

Run:

```powershell
node scripts/verify-generation-library-preview-contract.mjs
```

Expected: PASS for drawer wiring.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/GenerationLibraryDrawer.tsx apps/web/src/components/GenerationLibraryPreviewOverlay.tsx scripts/verify-generation-library-preview-contract.mjs
git commit -m "feat: add generation library preview and download actions"
```

### Task 7: Add explicit route/layout verification coverage

**Files:**
- Modify: `scripts/verify-generation-library-and-admin-assistant-layout.mjs`
- Test: `scripts/verify-generation-library-and-admin-assistant-layout.mjs`

- [ ] **Step 1: Extend the existing generation-library contract**

Add assertions such as:

```javascript
assert.match(apiServer, /previewUrl:/, "generation library responses should expose previewUrl metadata");
assert.match(apiServer, /downloadUrl:/, "generation library responses should expose downloadUrl metadata");
assert.match(apiServer, /\/api\/materials\/generation-library\/\(\[\^\/\]\+\)\/content/, "generation library content route should exist");
assert.match(drawer, /下载/, "generation library drawer should expose download action");
assert.match(drawer, /查看/, "generation library drawer should expose preview action");
assert.match(drawer, /GenerationLibraryPreviewOverlay/, "generation library drawer should wire the preview overlay");
```

- [ ] **Step 2: Run the contract script to verify it fails before the changes are complete**

Run:

```powershell
node scripts/verify-generation-library-and-admin-assistant-layout.mjs
```

Expected: FAIL until all route/layout wiring is present.

- [ ] **Step 3: Re-run the contract after completing prior tasks**

Run:

```powershell
node scripts/verify-generation-library-and-admin-assistant-layout.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-generation-library-and-admin-assistant-layout.mjs
git commit -m "test: cover generation library material access layout"
```

### Task 8: Run implementation verification

**Files:**
- Test: `scripts/verify-generation-library-material-access-contract.mjs`
- Test: `scripts/verify-generation-library-preview-contract.mjs`
- Test: `scripts/verify-generation-library-and-admin-assistant-layout.mjs`
- Test: `apps/api/src/server.ts`
- Test: `apps/web/src/components/GenerationLibraryDrawer.tsx`

- [ ] **Step 1: Run backend material-access contract verification**

Run:

```powershell
node scripts/verify-generation-library-material-access-contract.mjs
```

Expected: PASS

- [ ] **Step 2: Run frontend preview contract verification**

Run:

```powershell
node scripts/verify-generation-library-preview-contract.mjs
```

Expected: PASS

- [ ] **Step 3: Run existing generation-library layout verification**

Run:

```powershell
node scripts/verify-generation-library-and-admin-assistant-layout.mjs
```

Expected: PASS

- [ ] **Step 4: Run focused type-checks**

Run:

```powershell
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/web
```

Expected: PASS

- [ ] **Step 5: Run focused builds**

Run:

```powershell
npm run build -w @xinghuan/api
npm run build -w @xinghuan/web
```

Expected: PASS

- [ ] **Step 6: Commit verification-only updates if any scripts were adjusted during debugging**

```bash
git add scripts/verify-generation-library-material-access-contract.mjs scripts/verify-generation-library-preview-contract.mjs scripts/verify-generation-library-and-admin-assistant-layout.mjs
git commit -m "test: finalize generation library verification coverage"
```

### Task 9: Update project records

**Files:**
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`

- [ ] **Step 1: Add DEVLOG entry for the new generation-library capability**

Add a top-of-file entry summarizing:

```markdown
### 生成库素材访问能力收口：图片/视频预览与下载

目标:

- 为生成库补齐图片/视频的查看与下载
- 抽出后端统一素材访问能力，当前先接生成库

变更:

- 新增 `material-access-service.ts`
- 生成库列表返回 `previewUrl` / `downloadUrl`
- 新增统一内容访问路由
- 生成库抽屉新增预览层与下载动作

验证:

- `node scripts/verify-generation-library-material-access-contract.mjs`
- `node scripts/verify-generation-library-preview-contract.mjs`
- `node scripts/verify-generation-library-and-admin-assistant-layout.mjs`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`
```

- [ ] **Step 2: Add MEMORY note for the new structure**

Add a note in the current structure section similar to:

```markdown
- `2026-06-16` 生成库素材访问能力已从“裸 `fileUrl`”升级为“访问描述 + 统一内容路由”：
  - 当前生成库列表已返回 `previewUrl` / `downloadUrl`
  - 当前统一内容路由已支持 `generation-library`
  - 资源库与输出素材后续应复用同一访问能力，不再各自拼下载/预览逻辑
```

- [ ] **Step 3: Run a quick grep to confirm the docs mention the exact new capability names**

Run:

```powershell
rg -n "previewUrl|downloadUrl|统一内容路由|generation-library" DEVLOG.md MEMORY.md
```

Expected: matching lines in both files.

- [ ] **Step 4: Commit the documentation updates**

```bash
git add DEVLOG.md MEMORY.md
git commit -m "docs: record generation library material access rollout"
```

---

## Spec Coverage Check

- Preview/download for images: covered by Tasks 3, 4, 5, 6
- Preview/download for videos: covered by Tasks 3, 4, 5, 6
- Unified backend material-access layer: covered by Tasks 1, 2, 3, 4
- Reuse-oriented design without full storage migration: covered by Tasks 1, 2, 3 and explicitly constrained by architecture
- Verification and regression protection: covered by Tasks 7 and 8
- Documentation/long-term memory: covered by Task 9

## Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation placeholders remain
- The plan uses exact file paths and explicit route names
- All new interfaces and route names are defined in the tasks that introduce them

## Type Consistency Check

- `MaterialSource` is consistently introduced as `"generation-library"`
- Access fields are consistently named `previewUrl`, `downloadUrl`, `openUrl`, `filename`, `canDownload`, `isExpired`
- The route is consistently `/api/materials/generation-library/:id/content`

---

Plan complete and saved to `docs/superpowers/plans/2026-06-16-generation-library-material-access-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
