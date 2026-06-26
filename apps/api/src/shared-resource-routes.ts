import { basename, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { enrichWorkflowResourceItem } from "./resource-workflow-helpers.js";

type ResourceKind = "image" | "video" | "audio" | "set" | "pose" | "workflow";

interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

interface ResourceItem {
  id: string;
  kind: ResourceKind;
  libraryScope?: "personal" | "shared";
  title: string;
  url?: string;
  sourceUrl?: string;
  originalName?: string;
  fileUrl?: string;
  fileRel?: string;
  mime?: string;
  size?: number;
  categoryId?: string;
  tags: string[];
  favorite: boolean;
  materialSetKind?: string;
  materialSetItems?: unknown[];
  poseBackup?: Record<string, unknown>;
  workflowFragment?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  workflowNodeCount?: number;
  workflowEdgeCount?: number;
  workflowNodeTypes?: string[];
  workflowPreview?: {
    nodes: Array<{ id: string; type: string; label: string; x: number; y: number }>;
    edges: Array<{ source: string; target: string }>;
  };
  revision: number;
  note?: string;
  publishedBy?: string;
  publishedAt?: number;
}

interface ResourceDb {
  categories: ResourceCategory[];
  items: ResourceItem[];
}

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
};

type HttpErrorLike = new (statusCode: number, message: string, payload?: Record<string, unknown>) => Error;

type SharedResourceRouteDeps = {
  adminDir: string;
  sharedResourceDbPath: string;
  safeText: (value: unknown, fallback?: string) => string;
  inferMime: (value: string) => string;
  normalizeResourceKind: (value: unknown) => ResourceKind | "";
  resourceRevisionFromPayload: (value: unknown) => number | undefined;
  readJsonBody: <T>(request: import("node:http").IncomingMessage) => Promise<T>;
  sendT8: (
    response: import("node:http").ServerResponse,
    data: unknown,
    statusCode?: number,
    headers?: Record<string, string>,
  ) => void;
  HttpError: HttpErrorLike;
  readResourceDb: (user: CurrentUser) => Promise<ResourceDb>;
  writeResourceDb: (db: ResourceDb, user: CurrentUser, options?: { pruneMissing?: boolean }) => Promise<void>;
  usePostgresRepository: () => boolean;
  upsertResourceItemPostgres: (item: ResourceItem, user: CurrentUser) => Promise<ResourceItem>;
};

export function createSharedResourceRouteHandler(deps: SharedResourceRouteDeps) {
  const {
    adminDir,
    sharedResourceDbPath,
    safeText,
    inferMime,
    normalizeResourceKind,
    resourceRevisionFromPayload,
    readJsonBody,
    sendT8,
    HttpError,
    readResourceDb,
    writeResourceDb,
    usePostgresRepository,
    upsertResourceItemPostgres,
  } = deps;

  async function readSharedResourceDb(): Promise<ResourceDb> {
    await mkdir(adminDir, { recursive: true });
    try {
      const raw = JSON.parse(await readFile(sharedResourceDbPath, "utf-8")) as ResourceDb;
      const categories = Array.isArray(raw.categories) ? raw.categories : [];
      const items = Array.isArray(raw.items)
        ? raw.items.map((item) => enrichWorkflowResourceItem({ ...item, libraryScope: "shared" as const }))
        : [];
      return { categories, items };
    } catch {
      return { categories: [], items: [] };
    }
  }

  async function writeSharedResourceDb(db: ResourceDb) {
    await mkdir(adminDir, { recursive: true });
    const normalized: ResourceDb = {
      categories: Array.isArray(db.categories) ? db.categories : [],
      items: Array.isArray(db.items)
        ? db.items.map((item) => {
            const next = { ...item };
            delete next.libraryScope;
            return next;
          })
        : [],
    };
    await writeFile(sharedResourceDbPath, JSON.stringify(normalized, null, 2), "utf-8");
  }

  function requireAdmin(currentUser: CurrentUser | null | undefined) {
    if (!currentUser || currentUser.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED");
    }
    return currentUser;
  }

  function requireUser(currentUser: CurrentUser | null | undefined) {
    if (!currentUser) throw new HttpError(401, "UNAUTHORIZED");
    return currentUser;
  }

  async function addSharedResourceFromPayload(raw: unknown, actor: CurrentUser, forcedKind?: ResourceKind) {
    const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const kind = forcedKind || normalizeResourceKind(payload.kind) || "image";
    const now = Date.now();
    const url = safeText(payload.url);
    const item: ResourceItem = {
      id: `shared-res-${now}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      libraryScope: "shared",
      title: safeText(payload.title, url ? basename(url) : kind === "set" ? "公共素材集" : "公共资源"),
      url,
      sourceUrl: safeText(payload.sourceUrl, url),
      originalName: safeText(payload.originalName),
      fileUrl: url,
      fileRel: url,
      mime: safeText(payload.mime, url ? inferMime(url) : ""),
      size: Number(payload.size) || 0,
      categoryId: safeText(payload.categoryId),
      tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => safeText(tag)).filter(Boolean) : [],
      favorite: Boolean(payload.favorite),
      materialSetKind: safeText(payload.materialSetKind),
      materialSetItems: Array.isArray(payload.materialSetItems) ? payload.materialSetItems : undefined,
      poseBackup: typeof payload.poseBackup === "object" ? (payload.poseBackup as Record<string, unknown>) : undefined,
      workflowFragment:
        typeof payload.workflowFragment === "object" ? (payload.workflowFragment as Record<string, unknown>) : undefined,
      createdAt: now,
      updatedAt: now,
      sourceNodeId: safeText(payload.sourceNodeId),
      sourceCanvasId: safeText(payload.sourceCanvasId),
      taskId: safeText(payload.taskId),
      providerId: safeText(payload.providerId),
      modelId: safeText(payload.modelId),
      revision: 1,
      note: safeText(payload.note),
      publishedBy: actor.id,
      publishedAt: now,
    };
    const db = await readSharedResourceDb();
    db.items.unshift(enrichWorkflowResourceItem(item));
    await writeSharedResourceDb(db);
    return item;
  }

  async function copySharedResourceToPersonal(id: string, user: CurrentUser) {
    const db = await readSharedResourceDb();
    const source = db.items.find((item) => item.id === id);
    if (!source) throw new Error("公共资源不存在");
    const now = Date.now();
    const clone: ResourceItem = {
      ...source,
      id: `res-${now}-${Math.random().toString(36).slice(2, 8)}`,
      libraryScope: "personal",
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
      revision: 1,
    };
    if (usePostgresRepository()) {
      await upsertResourceItemPostgres(clone, user);
    } else {
      const personalDb = await readResourceDb(user);
      personalDb.items.unshift(clone);
      await writeResourceDb(personalDb, user);
    }
    return clone;
  }

  function pickResourcePatch(patch: Partial<ResourceItem>) {
    return {
      ...(patch.title !== undefined ? { title: safeText(patch.title) } : {}),
      ...(patch.categoryId !== undefined ? { categoryId: safeText(patch.categoryId) } : {}),
      ...(patch.tags !== undefined && Array.isArray(patch.tags)
        ? { tags: patch.tags.map((tag) => safeText(tag)).filter(Boolean) }
        : {}),
      ...(patch.favorite !== undefined ? { favorite: Boolean(patch.favorite) } : {}),
      ...(patch.note !== undefined ? { note: safeText(patch.note) } : {}),
    };
  }

  return async function handleSharedResourceRoutes({
    request,
    response,
    url,
    currentUser,
  }: {
    request: import("node:http").IncomingMessage;
    response: import("node:http").ServerResponse;
    url: URL;
    currentUser: CurrentUser | null;
  }) {
    if (url.pathname === "/api/shared-resources/categories") {
      if (request.method === "GET") {
        const kind = normalizeResourceKind(url.searchParams.get("kind"));
        const db = await readSharedResourceDb();
        sendT8(response, kind ? db.categories.filter((item) => item.kind === kind) : db.categories);
        return true;
      }
      requireAdmin(currentUser);
      if (request.method === "POST") {
        const body = await readJsonBody<{ kind?: string; name?: string }>(request);
        const kind = normalizeResourceKind(body.kind) || "image";
        const now = Date.now();
        const category: ResourceCategory = {
          id: `shared-cat-${now}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          name: safeText(body.name, "未分类"),
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        const db = await readSharedResourceDb();
        db.categories.push(category);
        await writeSharedResourceDb(db);
        sendT8(response, category);
        return true;
      }
      return false;
    }

    const sharedResourceCategoryMatch = url.pathname.match(/^\/api\/shared-resources\/categories\/([^/]+)$/);
    if (sharedResourceCategoryMatch) {
      const id = decodeURIComponent(sharedResourceCategoryMatch[1]);
      requireAdmin(currentUser);
      if (request.method === "PUT") {
        const body = await readJsonBody<{ name?: string; revision?: number }>(request);
        const db = await readSharedResourceDb();
        const current = db.categories.find((item) => item.id === id);
        if (!current) throw new Error("分类不存在");
        const expectedRevision = resourceRevisionFromPayload(body);
        if (expectedRevision !== undefined && expectedRevision !== current.revision) {
          throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
            resourceKind: "category",
            resourceId: id,
            currentRevision: current.revision,
          });
        }
        const updated = db.categories.map((item) =>
          item.id === id
            ? { ...item, name: safeText(body.name, item.name), revision: (item.revision || 1) + 1, updatedAt: Date.now() }
            : item,
        );
        await writeSharedResourceDb({ ...db, categories: updated });
        sendT8(response, updated.find((item) => item.id === id) ?? null);
        return true;
      }
      if (request.method === "DELETE") {
        const body = await readJsonBody<{ revision?: number }>(request);
        const db = await readSharedResourceDb();
        const current = db.categories.find((item) => item.id === id);
        if (!current) throw new Error("分类不存在");
        const expectedRevision = resourceRevisionFromPayload(body);
        if (expectedRevision !== undefined && expectedRevision !== current.revision) {
          throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
            resourceKind: "category",
            resourceId: id,
            currentRevision: current.revision,
          });
        }
        await writeSharedResourceDb({
          categories: db.categories.filter((item) => item.id !== id),
          items: db.items.map((item) =>
            item.categoryId === id
              ? { ...item, categoryId: "", revision: (item.revision || 1) + 1, updatedAt: Date.now() }
              : item,
          ),
        });
        sendT8(response, { movedTo: "" });
        return true;
      }
      return false;
    }

    if (url.pathname === "/api/shared-resources/items") {
      const db = await readSharedResourceDb();
      const kind = normalizeResourceKind(url.searchParams.get("kind"));
      const categoryId = safeText(url.searchParams.get("categoryId"), "");
      const q = safeText(url.searchParams.get("q"), "").toLowerCase();
      const favorite = url.searchParams.get("favorite") === "1";
      sendT8(
        response,
        db.items.filter((item) => {
          if (kind && item.kind !== kind) return false;
          if (categoryId && item.categoryId !== categoryId) return false;
          if (favorite && !item.favorite) return false;
          if (q && !`${item.title} ${(item.tags || []).join(" ")} ${item.note || ""}`.toLowerCase().includes(q)) return false;
          return true;
        }),
      );
      return true;
    }

    if (url.pathname === "/api/shared-resources/items/add" && request.method === "POST") {
      sendT8(response, await addSharedResourceFromPayload(await readJsonBody(request), requireAdmin(currentUser)));
      return true;
    }

    if (url.pathname === "/api/shared-resources/sets/add" && request.method === "POST") {
      sendT8(response, await addSharedResourceFromPayload(await readJsonBody(request), requireAdmin(currentUser), "set"));
      return true;
    }

    if (url.pathname === "/api/shared-resources/poses/add" && request.method === "POST") {
      sendT8(response, await addSharedResourceFromPayload(await readJsonBody(request), requireAdmin(currentUser), "pose"));
      return true;
    }

    if (url.pathname === "/api/shared-resources/workflows/add" && request.method === "POST") {
      sendT8(
        response,
        await addSharedResourceFromPayload(await readJsonBody(request), requireAdmin(currentUser), "workflow"),
      );
      return true;
    }

    const sharedCopyToPersonalMatch = url.pathname.match(/^\/api\/shared-resources\/items\/([^/]+)\/copy-to-personal$/);
    if (sharedCopyToPersonalMatch && request.method === "POST") {
      const id = decodeURIComponent(sharedCopyToPersonalMatch[1]);
      sendT8(response, await copySharedResourceToPersonal(id, requireUser(currentUser)));
      return true;
    }

    const sharedResourceItemMatch = url.pathname.match(/^\/api\/shared-resources\/items\/([^/]+)$/);
    if (sharedResourceItemMatch) {
      const id = decodeURIComponent(sharedResourceItemMatch[1]);
      requireAdmin(currentUser);
      if (request.method === "PUT") {
        const patch = await readJsonBody<Partial<ResourceItem> & { touch?: boolean }>(request);
        const db = await readSharedResourceDb();
        const current = db.items.find((item) => item.id === id);
        if (!current) throw new Error("资源不存在");
        const expectedRevision = resourceRevisionFromPayload(patch);
        if (expectedRevision !== undefined && expectedRevision !== current.revision) {
          throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
            resourceKind: "item",
            resourceId: id,
            currentRevision: current.revision,
          });
        }
        const updated = db.items.map((item) =>
          item.id === id
            ? enrichWorkflowResourceItem({
                ...item,
                ...pickResourcePatch(patch),
                revision: (item.revision || 1) + 1,
                updatedAt: Date.now(),
                ...(patch.touch ? { lastUsedAt: Date.now() } : {}),
              })
            : item,
        );
        await writeSharedResourceDb({ ...db, items: updated });
        sendT8(response, updated.find((item) => item.id === id) ?? null);
        return true;
      }
      if (request.method === "DELETE") {
        const body = await readJsonBody<{ revision?: number }>(request);
        const db = await readSharedResourceDb();
        const current = db.items.find((item) => item.id === id);
        if (!current) throw new Error("资源不存在");
        const expectedRevision = resourceRevisionFromPayload(body);
        if (expectedRevision !== undefined && expectedRevision !== current.revision) {
          throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
            resourceKind: "item",
            resourceId: id,
            currentRevision: current.revision,
          });
        }
        await writeSharedResourceDb({ ...db, items: db.items.filter((item) => item.id !== id) });
        sendT8(response, null);
        return true;
      }
      return false;
    }

    return false;
  };
}
