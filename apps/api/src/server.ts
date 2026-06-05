import { createHealthPayload, type AppEnvironment } from "@xinghuan/shared";
import Busboy from "busboy";
import { createServer } from "node:http";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const host = process.env.XINGHUAN_API_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.XINGHUAN_API_PORT ?? "18300", 10);
const environment = (process.env.XINGHUAN_APP_ENV ?? "local") as AppEnvironment;
const dataDir = process.env.XINGHUAN_DATA_DIR ?? join(process.cwd(), "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const redisUrl = process.env.XINGHUAN_REDIS_URL || process.env.REDIS_URL || "";
const taskQueueName = process.env.XINGHUAN_TASK_QUEUE || "xinghuan:tasks";
const authDir = join(dataDir, "auth");
const adminDir = join(dataDir, "admin");
const usersDir = join(dataDir, "users");
const authDbPath = join(authDir, "auth.json");
const adminDbPath = join(adminDir, "admin.json");
const sessionCookieName = "xh_session";
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
const webDistCandidates = [
  process.env.XINGHUAN_WEB_DIST_DIR,
  resolve(process.cwd(), "../../apps/web/dist"),
  resolve(process.cwd(), "apps/web/dist"),
].filter(Boolean) as string[];
const adminDistCandidates = [
  process.env.XINGHUAN_ADMIN_DIST_DIR,
  resolve(process.cwd(), "../../apps/admin/dist"),
  resolve(process.cwd(), "apps/admin/dist"),
].filter(Boolean) as string[];

interface CanvasListItem {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
}

interface CanvasData {
  nodes: unknown[];
  edges: unknown[];
  viewport: { x: number; y: number; zoom: number };
  nextNodeSerialId?: number;
}

type ResourceKind = "image" | "video" | "audio" | "set" | "pose" | "workflow";

interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ResourceItem {
  id: string;
  kind: ResourceKind;
  title: string;
  url?: string;
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
}

interface ResourceDb {
  categories: ResourceCategory[];
  items: ResourceItem[];
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  passwordHash: string;
  disabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SessionRecord {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface AuthDb {
  users: UserRecord[];
  sessions: SessionRecord[];
}

type CurrentUser = Pick<UserRecord, "id" | "email" | "name" | "role">;

type ModelCapability = "text" | "image" | "video" | "audio";
type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface AdminProviderRecord {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  apiKey?: string;
  apiKeyPreview?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface AdminModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: ModelCapability;
  enabled: boolean;
  inputProfile: string;
  parameterSchema: string;
  createdAt: number;
  updatedAt: number;
}

interface AdminTaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  providerId?: string;
  modelId?: string;
  logs: string[];
  createdAt: number;
  updatedAt: number;
}

interface AdminDb {
  providers: AdminProviderRecord[];
  models: AdminModelRecord[];
  tasks: AdminTaskRecord[];
  auditLogs?: AdminAuditRecord[];
}

interface AdminAuditRecord {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: number;
}

const emptyCanvasData = (): CanvasData => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  nextNodeSerialId: 1,
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    response.end();
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/api/health") {
    sendJson(response, createHealthPayload("xinghuan-api", environment));
    return;
  }

  if (url.pathname === "/api/status") {
    sendT8(response, {
      status: "ok",
      service: "xinghuan-api",
      version: "0.1.0",
      environment,
      dataDir,
    });
    return;
  }

  if (url.pathname === "/api/version") {
    sendJson(response, createHealthPayload("xinghuan-api-version", environment));
    return;
  }

  try {
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = await getCurrentUser(request);
      sendT8(response, { authenticated: Boolean(user), user });
      return;
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readJsonBody<{ email?: string; password?: string }>(request);
      const login = await loginUser(body.email, body.password);
      if (!login) {
        sendJson(response, { ok: false, success: false, error: "INVALID_CREDENTIALS" }, 401);
        return;
      }
      sendT8(response, { authenticated: true, user: toPublicUser(login.user) }, 200, {
        "set-cookie": buildSessionCookie(request, login.session.id),
      });
      return;
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      await logoutUser(request);
      sendT8(response, { authenticated: false }, 200, {
        "set-cookie": expireSessionCookie(request),
      });
      return;
    }

    const currentUser = await getCurrentUser(request);
    if (isProtectedRequest(url.pathname) && !currentUser) {
      sendJson(response, { ok: false, success: false, error: "AUTH_REQUIRED" }, 401);
      return;
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!currentUser || currentUser.role !== "admin") {
        sendJson(response, { ok: false, success: false, error: "ADMIN_REQUIRED" }, 403);
        return;
      }
      if (await handleAdminRequest(request, response, url, currentUser)) return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/files/input/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).inputDir, url.pathname.slice("/files/input/".length));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/files/output/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).outputDir, url.pathname.slice("/files/output/".length));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/input/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).inputDir, url.pathname.slice("/input/".length));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/output/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).outputDir, url.pathname.slice("/output/".length));
      return;
    }

    if (url.pathname === "/api/files/upload" && request.method === "POST") {
      sendT8(response, await handleMultipartUpload(request, currentUser!));
      return;
    }

    if (url.pathname === "/api/files/upload-base64" && request.method === "POST") {
      const body = await readJsonBody<{ dataUrl?: string; prefix?: string }>(request);
      sendT8(response, await saveBase64File(body, currentUser!));
      return;
    }

    if (url.pathname === "/api/files/list" && request.method === "GET") {
      sendT8(response, await listOutputFiles(currentUser!));
      return;
    }

    if (url.pathname === "/api/files/save-to-disk" && request.method === "POST") {
      const body = await readJsonBody<{ url?: string; filename?: string }>(request);
      sendT8(response, await saveToOutput(body, currentUser!));
      return;
    }

    if (url.pathname === "/api/files/duck-decode" && request.method === "POST") {
      const body = await readJsonBody<{ urls?: string[] }>(request);
      sendT8(response, {
        items: (Array.isArray(body.urls) ? body.urls : []).map((sourceUrl) => ({
          sourceUrl,
          decoded: false,
          reason: "duck_decode_not_enabled",
        })),
        decodedCount: 0,
      });
      return;
    }

    if (url.pathname === "/api/settings" || url.pathname === "/api/settings/raw") {
      if (request.method === "GET") {
        sendT8(response, defaultSettings());
        return;
      }
      if (request.method === "POST") {
        sendT8(response, defaultSettings());
        return;
      }
    }

    if (url.pathname === "/api/settings/rh-tool-categories" || url.pathname === "/api/settings/rh-tool-apps") {
      sendT8(response, []);
      return;
    }

    if (url.pathname === "/api/themes/templates") {
      if (request.method === "GET") {
        sendT8(response, { path: join(dataDir, "theme-templates"), templates: [] });
        return;
      }
      if (request.method === "POST") {
        sendT8(response, null);
        return;
      }
    }

    const themeMatch = url.pathname.match(/^\/api\/themes\/templates\/([^/]+)$/);
    if (themeMatch && (request.method === "PUT" || request.method === "DELETE")) {
      sendT8(response, request.method === "DELETE" ? null : await readJsonBody(request));
      return;
    }

    if (url.pathname === "/api/resources/categories") {
      if (request.method === "GET") {
        const kind = normalizeResourceKind(url.searchParams.get("kind"));
        const db = await readResourceDb(currentUser!);
        sendT8(response, kind ? db.categories.filter((item) => item.kind === kind) : db.categories);
        return;
      }
      if (request.method === "POST") {
        const body = await readJsonBody<{ kind?: string; name?: string }>(request);
        const kind = normalizeResourceKind(body.kind) || "image";
        const now = Date.now();
        const category: ResourceCategory = {
          id: `cat-${now}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          name: safeText(body.name, "未分类"),
          createdAt: now,
          updatedAt: now,
        };
        const db = await readResourceDb(currentUser!);
        db.categories.push(category);
        await writeResourceDb(db, currentUser!);
        sendT8(response, category);
        return;
      }
    }

    const resourceCategoryMatch = url.pathname.match(/^\/api\/resources\/categories\/([^/]+)$/);
    if (resourceCategoryMatch) {
      const id = decodeURIComponent(resourceCategoryMatch[1]);
      const db = await readResourceDb(currentUser!);
      if (request.method === "PUT") {
        const body = await readJsonBody<{ name?: string }>(request);
        const updated = db.categories.map((item) =>
          item.id === id ? { ...item, name: safeText(body.name, item.name), updatedAt: Date.now() } : item,
        );
        await writeResourceDb({ ...db, categories: updated }, currentUser!);
        sendT8(response, updated.find((item) => item.id === id) ?? null);
        return;
      }
      if (request.method === "DELETE") {
        await writeResourceDb({
          categories: db.categories.filter((item) => item.id !== id),
          items: db.items.map((item) => (item.categoryId === id ? { ...item, categoryId: "" } : item)),
        }, currentUser!);
        sendT8(response, { movedTo: "" });
        return;
      }
    }

    if (url.pathname === "/api/resources/items") {
      const db = await readResourceDb(currentUser!);
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
          if (q && !`${item.title} ${(item.tags || []).join(" ")}`.toLowerCase().includes(q)) return false;
          return true;
        }),
      );
      return;
    }

    if (url.pathname === "/api/resources/items/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!));
      return;
    }

    if (url.pathname === "/api/resources/sets/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!, "set"));
      return;
    }

    if (url.pathname === "/api/resources/poses/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!, "pose"));
      return;
    }

    if (url.pathname === "/api/resources/workflows/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!, "workflow"));
      return;
    }

    const resourceItemMatch = url.pathname.match(/^\/api\/resources\/items\/([^/]+)$/);
    if (resourceItemMatch) {
      const id = decodeURIComponent(resourceItemMatch[1]);
      const db = await readResourceDb(currentUser!);
      if (request.method === "PUT") {
        const patch = await readJsonBody<Partial<ResourceItem> & { touch?: boolean }>(request);
        const updated = db.items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...pickResourcePatch(patch),
                updatedAt: Date.now(),
                ...(patch.touch ? { lastUsedAt: Date.now() } : {}),
              }
            : item,
        );
        await writeResourceDb({ ...db, items: updated }, currentUser!);
        sendT8(response, updated.find((item) => item.id === id) ?? null);
        return;
      }
      if (request.method === "DELETE") {
        await writeResourceDb({ ...db, items: db.items.filter((item) => item.id !== id) }, currentUser!);
        sendT8(response, null);
        return;
      }
    }

    if (url.pathname === "/api/cloud-uploads/status") {
      sendT8(response, { targets: [], summary: { enabledCount: 0, totalCount: 0 } });
      return;
    }

    if (url.pathname === "/api/canvas") {
      if (request.method === "GET") {
        sendT8(response, await readCanvasList(currentUser!));
        return;
      }
      if (request.method === "POST") {
        const body = await readJsonBody<{ name?: string }>(request);
        const now = Date.now();
        const id = `canvas-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const item: CanvasListItem = {
          id,
          name: body.name || "未命名画布",
          nodeCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        const list = await readCanvasList(currentUser!);
        await writeCanvasData(id, emptyCanvasData(), currentUser!);
        await writeCanvasList([item, ...list], currentUser!);
        sendT8(response, item);
        return;
      }
    }

    const canvasNameMatch = url.pathname.match(/^\/api\/canvas\/([^/]+)\/name$/);
    if (canvasNameMatch && request.method === "PATCH") {
      const id = decodeURIComponent(canvasNameMatch[1]);
      const body = await readJsonBody<{ name?: string }>(request);
      const list = await readCanvasList(currentUser!);
      const updated = list.map((item) =>
        item.id === id ? { ...item, name: body.name || item.name, updatedAt: Date.now() } : item,
      );
      await writeCanvasList(updated, currentUser!);
      sendT8(response, updated.find((item) => item.id === id) ?? null);
      return;
    }

    const canvasAutoSaveMatch = url.pathname.match(/^\/api\/canvas\/([^/]+)\/auto-save$/);
    if (canvasAutoSaveMatch && request.method === "POST") {
      const id = decodeURIComponent(canvasAutoSaveMatch[1]);
      const data = normalizeCanvasData(await readJsonBody(request));
      await writeCanvasAndUpdateList(id, data, currentUser!);
      sendT8(response, {
        path: canvasDataPath(id, currentUser!),
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
      });
      return;
    }

    const canvasMatch = url.pathname.match(/^\/api\/canvas\/([^/]+)$/);
    if (canvasMatch) {
      const id = decodeURIComponent(canvasMatch[1]);
      if (request.method === "GET") {
        sendT8(response, await readCanvasData(id, currentUser!));
        return;
      }
      if (request.method === "PUT") {
        const data = normalizeCanvasData(await readJsonBody(request));
        await writeCanvasAndUpdateList(id, data, currentUser!);
        sendT8(response, {
          path: canvasDataPath(id, currentUser!),
          nodeCount: data.nodes.length,
          edgeCount: data.edges.length,
        });
        return;
      }
      if (request.method === "DELETE") {
        const list = await readCanvasList(currentUser!);
        await writeCanvasList(list.filter((item) => item.id !== id), currentUser!);
        await unlink(canvasDataPath(id, currentUser!)).catch(() => undefined);
        sendT8(response, null);
        return;
      }
    }

    if (request.method === "GET" && (await sendAdminAsset(response, url.pathname))) {
      return;
    }

    if (request.method === "GET" && (await sendWebAsset(response, url.pathname))) {
      return;
    }

    sendJson(response, { ok: false, success: false, error: "NOT_FOUND" }, 404);
  } catch (error) {
    sendJson(
      response,
      {
        ok: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

server.listen(port, host, () => {
  console.log(`xinghuan-api listening on http://${host}:${port}`);
});

async function handleAdminRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  adminUser: CurrentUser,
) {
  if (url.pathname === "/api/admin/summary" && request.method === "GET") {
    const [authDb, adminDb, storage] = await Promise.all([readAuthDb(), readAdminDb(), readStorageStats()]);
    sendT8(response, {
      users: authDb.users.length,
      enabledUsers: authDb.users.filter((user) => !user.disabled).length,
      providers: adminDb.providers.length,
      enabledProviders: adminDb.providers.filter((provider) => provider.enabled).length,
      models: adminDb.models.length,
      enabledModels: adminDb.models.filter((model) => model.enabled).length,
      tasks: adminDb.tasks.length,
      runningTasks: adminDb.tasks.filter((task) => task.status === "queued" || task.status === "running").length,
      auditLogs: adminDb.auditLogs?.length || 0,
      storage,
      environment,
    });
    return true;
  }

  if (url.pathname === "/api/admin/users") {
    const authDb = await readAuthDb();
    if (request.method === "GET") {
      sendT8(response, authDb.users.map(toAdminUser));
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<{ email?: string; name?: string; role?: string; password?: string }>(request);
      const email = safeEmail(body.email);
      if (!email) throw new Error("缺少邮箱");
      if (authDb.users.some((user) => user.email.toLowerCase() === email)) throw new Error("邮箱已存在");
      const now = Date.now();
      const user: UserRecord = {
        id: `usr-${now}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        name: safeText(body.name, email.split("@")[0]),
        role: body.role === "admin" ? "admin" : "member",
        passwordHash: hashPassword(String(body.password || randomToken(10))),
        createdAt: now,
        updatedAt: now,
      };
      await writeAuthDb({ ...authDb, users: [user, ...authDb.users] });
      await appendAudit(adminUser, "user.create", "user", user.id, `创建用户 ${user.email}`);
      sendT8(response, toAdminUser(user));
      return true;
    }
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && request.method === "PATCH") {
    const id = decodeURIComponent(userMatch[1]);
    const body = await readJsonBody<{ email?: string; name?: string; role?: string; disabled?: boolean; password?: string }>(request);
    const authDb = await readAuthDb();
    let updatedUser: UserRecord | undefined;
    const users = authDb.users.map((user) => {
      if (user.id !== id) return user;
      const nextEmail = body.email === undefined ? user.email : safeEmail(body.email);
      if (!nextEmail) throw new Error("邮箱无效");
      const next: UserRecord = {
        ...user,
        email: nextEmail,
        name: body.name === undefined ? user.name : safeText(body.name, user.name),
        role: body.role === "admin" ? "admin" : body.role === "member" ? "member" : user.role,
        disabled: body.disabled === undefined ? user.disabled : Boolean(body.disabled),
        updatedAt: Date.now(),
      };
      if (body.password) next.passwordHash = hashPassword(String(body.password));
      updatedUser = next;
      return next;
    });
    if (!updatedUser) throw new Error("用户不存在");
    if (users.some((user) => user.id !== id && user.email.toLowerCase() === updatedUser!.email.toLowerCase())) {
      throw new Error("邮箱已存在");
    }
    await writeAuthDb({
      ...authDb,
      users,
      sessions: authDb.sessions.filter((session) => session.userId !== id),
    });
    await appendAudit(adminUser, "user.update", "user", id, `更新用户 ${updatedUser.email}`);
    sendT8(response, toAdminUser(updatedUser));
    return true;
  }

  if (url.pathname === "/api/admin/providers") {
    const db = await readAdminDb();
    if (request.method === "GET") {
      sendT8(response, db.providers.map(toPublicProvider));
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminProviderRecord>>(request);
      const now = Date.now();
      const provider: AdminProviderRecord = {
        id: safeSlug(body.id, `provider-${now}`),
        name: safeText(body.name, "新服务商"),
        baseUrl: safeText(body.baseUrl),
        enabled: Boolean(body.enabled),
        apiKey: encryptSecret(safeText(body.apiKey)),
        apiKeyPreview: secretPreview(safeText(body.apiKey)),
        note: safeText(body.note),
        createdAt: now,
        updatedAt: now,
      };
      if (db.providers.some((item) => item.id === provider.id)) throw new Error("Provider ID 已存在");
      await writeAdminDb({ ...db, providers: [provider, ...db.providers] });
      await appendAudit(adminUser, "provider.create", "provider", provider.id, `创建 Provider ${provider.name}`);
      sendT8(response, toPublicProvider(provider));
      return true;
    }
  }

  const providerMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)$/);
  if (providerMatch && request.method === "PATCH") {
    const id = decodeURIComponent(providerMatch[1]);
    const body = await readJsonBody<Partial<AdminProviderRecord> & { clearApiKey?: boolean }>(request);
    const db = await readAdminDb();
    let updated: AdminProviderRecord | undefined;
    const providers = db.providers.map((provider) => {
      if (provider.id !== id) return provider;
      const next: AdminProviderRecord = {
        ...provider,
        name: body.name === undefined ? provider.name : safeText(body.name, provider.name),
        baseUrl: body.baseUrl === undefined ? provider.baseUrl : safeText(body.baseUrl),
        enabled: body.enabled === undefined ? provider.enabled : Boolean(body.enabled),
        note: body.note === undefined ? provider.note : safeText(body.note),
        updatedAt: Date.now(),
      };
      if (body.clearApiKey) {
        delete next.apiKey;
        delete next.apiKeyPreview;
      }
      if (body.apiKey) {
        const apiKey = safeText(body.apiKey);
        next.apiKey = encryptSecret(apiKey);
        next.apiKeyPreview = secretPreview(apiKey);
      }
      updated = next;
      return next;
    });
    if (!updated) throw new Error("Provider 不存在");
    await writeAdminDb({ ...db, providers });
    await appendAudit(adminUser, "provider.update", "provider", id, `更新 Provider ${updated.name}`);
    sendT8(response, toPublicProvider(updated));
    return true;
  }

  if (url.pathname === "/api/admin/models") {
    const db = await readAdminDb();
    if (request.method === "GET") {
      sendT8(response, db.models);
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminModelRecord>>(request);
      const now = Date.now();
      const model: AdminModelRecord = {
        id: safeSlug(body.id, `model-${now}`),
        providerId: safeSlug(body.providerId, "provider"),
        modelId: safeText(body.modelId, "model"),
        displayName: safeText(body.displayName, "新模型"),
        capability: normalizeCapability(body.capability),
        enabled: Boolean(body.enabled),
        inputProfile: safeText(body.inputProfile, "prompt"),
        parameterSchema: safeJsonText(body.parameterSchema, "{}"),
        createdAt: now,
        updatedAt: now,
      };
      if (db.models.some((item) => item.id === model.id)) throw new Error("模型 ID 已存在");
      await writeAdminDb({ ...db, models: [model, ...db.models] });
      await appendAudit(adminUser, "model.create", "model", model.id, `创建模型 ${model.displayName}`);
      sendT8(response, model);
      return true;
    }
  }

  const modelMatch = url.pathname.match(/^\/api\/admin\/models\/([^/]+)$/);
  if (modelMatch && request.method === "PATCH") {
    const id = decodeURIComponent(modelMatch[1]);
    const body = await readJsonBody<Partial<AdminModelRecord>>(request);
    const db = await readAdminDb();
    let updated: AdminModelRecord | undefined;
    const models = db.models.map((model) => {
      if (model.id !== id) return model;
      const next: AdminModelRecord = {
        ...model,
        providerId: body.providerId === undefined ? model.providerId : safeSlug(body.providerId, model.providerId),
        modelId: body.modelId === undefined ? model.modelId : safeText(body.modelId, model.modelId),
        displayName: body.displayName === undefined ? model.displayName : safeText(body.displayName, model.displayName),
        capability: body.capability === undefined ? model.capability : normalizeCapability(body.capability),
        enabled: body.enabled === undefined ? model.enabled : Boolean(body.enabled),
        inputProfile: body.inputProfile === undefined ? model.inputProfile : safeText(body.inputProfile, model.inputProfile),
        parameterSchema: body.parameterSchema === undefined ? model.parameterSchema : safeJsonText(body.parameterSchema, "{}"),
        updatedAt: Date.now(),
      };
      updated = next;
      return next;
    });
    if (!updated) throw new Error("模型不存在");
    await writeAdminDb({ ...db, models });
    await appendAudit(adminUser, "model.update", "model", id, `更新模型 ${updated.displayName}`);
    sendT8(response, updated);
    return true;
  }

  if (url.pathname === "/api/admin/tasks") {
    const db = await readAdminDb();
    if (request.method === "GET") {
      sendT8(response, db.tasks);
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminTaskRecord>>(request);
      const now = Date.now();
      const task: AdminTaskRecord = {
        id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: safeText(body.title, "后台测试任务"),
        status: normalizeTaskStatus(body.status),
        ownerId: safeText(body.ownerId, adminUser.id),
        providerId: safeText(body.providerId),
        modelId: safeText(body.modelId),
        logs: Array.isArray(body.logs) ? body.logs.map((line) => safeText(line)).filter(Boolean) : ["任务由后台创建"],
        createdAt: now,
        updatedAt: now,
      };
      await writeAdminDb({ ...db, tasks: [task, ...db.tasks] });
      const queueResult = task.status === "queued" ? await enqueueTask(task.id) : { queued: false, reason: "not_queued_status" };
      const queuedTask: AdminTaskRecord = {
        ...task,
        logs: [
          ...task.logs,
          queueResult.queued ? `已进入 Redis 队列 ${taskQueueName}` : `未进入 Redis 队列: ${queueResult.reason}`,
        ],
        updatedAt: Date.now(),
      };
      await writeAdminDb({ ...db, tasks: [queuedTask, ...db.tasks] });
      await appendAudit(adminUser, "task.create", "task", task.id, `创建任务 ${task.title}`);
      sendT8(response, queuedTask);
      return true;
    }
  }

  const taskMatch = url.pathname.match(/^\/api\/admin\/tasks\/([^/]+)$/);
  if (taskMatch && request.method === "PATCH") {
    const id = decodeURIComponent(taskMatch[1]);
    const body = await readJsonBody<Partial<AdminTaskRecord>>(request);
    const db = await readAdminDb();
    let updated: AdminTaskRecord | undefined;
    let shouldEnqueue = false;
    const tasks = db.tasks.map((task) => {
      if (task.id !== id) return task;
      const nextStatus = body.status === undefined ? task.status : normalizeTaskStatus(body.status);
      const next: AdminTaskRecord = {
        ...task,
        title: body.title === undefined ? task.title : safeText(body.title, task.title),
        status: nextStatus,
        logs: body.logs === undefined ? task.logs : body.logs.map((line) => safeText(line)).filter(Boolean),
        updatedAt: Date.now(),
      };
      if (task.status !== "queued" && nextStatus === "queued") {
        next.logs = [...next.logs, "任务已重新排队"];
        shouldEnqueue = true;
      }
      updated = next;
      return next;
    });
    if (!updated) throw new Error("任务不存在");
    await writeAdminDb({ ...db, tasks });
    if (shouldEnqueue) {
      const queueResult = await enqueueTask(id);
      const afterQueue = await readAdminDb();
      const queuedTasks = afterQueue.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              logs: [
                ...task.logs,
                queueResult.queued ? `已进入 Redis 队列 ${taskQueueName}` : `未进入 Redis 队列: ${queueResult.reason}`,
              ],
              updatedAt: Date.now(),
            }
          : task,
      );
      await writeAdminDb({ ...afterQueue, tasks: queuedTasks });
      updated = queuedTasks.find((task) => task.id === id);
    }
    if (!updated) throw new Error("任务不存在");
    await appendAudit(adminUser, "task.update", "task", id, `更新任务 ${updated.title}`);
    sendT8(response, updated);
    return true;
  }

  if (url.pathname === "/api/admin/system" && request.method === "GET") {
    sendT8(response, {
      environment,
      dataDir,
      database: await readDatabaseStatus(),
      redis: await readRedisStatus(),
      storageDriver,
      authDbPath,
      adminDbPath,
      service: "xinghuan-api",
      version: "0.1.0",
      storage: await readStorageStats(),
    });
    return true;
  }

  if (url.pathname === "/api/admin/audit" && request.method === "GET") {
    const db = await readAdminDb();
    sendT8(response, (db.auditLogs || []).slice(0, 200));
    return true;
  }

  return false;
}

function sendJson(
  response: import("node:http").ServerResponse,
  payload: unknown,
  statusCode = 200,
  headers: Record<string, string> = {},
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-credentials": "true",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendT8(
  response: import("node:http").ServerResponse,
  data: unknown,
  statusCode = 200,
  headers: Record<string, string> = {},
) {
  sendJson(response, { success: true, data }, statusCode, headers);
}

function isProtectedRequest(pathname: string) {
  if (pathname === "/health" || pathname === "/api/health" || pathname === "/api/status" || pathname === "/api/version") {
    return false;
  }
  if (pathname.startsWith("/api/auth/")) return false;
  return pathname.startsWith("/api/") || pathname.startsWith("/files/") || pathname.startsWith("/input/") || pathname.startsWith("/output/");
}

function userDataDirs(user: CurrentUser) {
  const baseDir = join(usersDir, safeUserId(user.id));
  const canvasDir = join(baseDir, "canvases");
  const inputDir = join(baseDir, "input");
  const outputDir = join(baseDir, "output");
  const resourceDir = join(baseDir, "resources");
  return {
    baseDir,
    canvasDir,
    inputDir,
    outputDir,
    resourceDir,
    canvasListPath: join(canvasDir, "canvas-list.json"),
    resourceDbPath: join(resourceDir, "resource-library.json"),
  };
}

async function ensureDataDirs(user?: CurrentUser) {
  await mkdir(authDir, { recursive: true });
  await mkdir(adminDir, { recursive: true });
  await mkdir(usersDir, { recursive: true });
  if (!user) return;
  const dirs = userDataDirs(user);
  await mkdir(dirs.canvasDir, { recursive: true });
  await mkdir(dirs.inputDir, { recursive: true });
  await mkdir(dirs.outputDir, { recursive: true });
  await mkdir(dirs.resourceDir, { recursive: true });
}

function canvasDataPath(id: string, user: CurrentUser) {
  return join(userDataDirs(user).canvasDir, `${id}.json`);
}

async function readCanvasList(user: CurrentUser): Promise<CanvasListItem[]> {
  await ensureDataDirs(user);
  try {
    return JSON.parse(await readFile(userDataDirs(user).canvasListPath, "utf-8")) as CanvasListItem[];
  } catch {
    return [];
  }
}

async function writeCanvasList(list: CanvasListItem[], user: CurrentUser) {
  await ensureDataDirs(user);
  await writeFile(userDataDirs(user).canvasListPath, JSON.stringify(list, null, 2), "utf-8");
}

async function readCanvasData(id: string, user: CurrentUser): Promise<CanvasData> {
  await ensureDataDirs(user);
  try {
    return normalizeCanvasData(JSON.parse(await readFile(canvasDataPath(id, user), "utf-8")));
  } catch {
    return emptyCanvasData();
  }
}

async function writeCanvasData(id: string, data: CanvasData, user: CurrentUser) {
  await ensureDataDirs(user);
  await writeFile(canvasDataPath(id, user), JSON.stringify(data, null, 2), "utf-8");
}

async function writeCanvasAndUpdateList(id: string, data: CanvasData, user: CurrentUser) {
  await writeCanvasData(id, data, user);
  const now = Date.now();
  const list = await readCanvasList(user);
  const existing = list.find((item) => item.id === id);
  const item: CanvasListItem = {
    id,
    name: existing?.name || "未命名画布",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    nodeCount: data.nodes.length,
  };
  await writeCanvasList([item, ...list.filter((entry) => entry.id !== id)], user);
}

function normalizeCanvasData(value: unknown): CanvasData {
  const data = (value && typeof value === "object" ? value : {}) as Partial<CanvasData>;
  return {
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    edges: Array.isArray(data.edges) ? data.edges : [],
    viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
    nextNodeSerialId: typeof data.nextNodeSerialId === "number" ? data.nextNodeSerialId : 1,
  };
}

async function readJsonBody<T = unknown>(request: import("node:http").IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

async function readAuthDb(): Promise<AuthDb> {
  if (usePostgresRepository()) return readAuthDbPostgres();
  await ensureDataDirs();
  let db: AuthDb;
  try {
    db = JSON.parse(await readFile(authDbPath, "utf-8")) as AuthDb;
  } catch {
    db = { users: [], sessions: [] };
  }
  const bootstrapped = await ensureBootstrapUser(db);
  const now = Date.now();
  const cleaned = {
    users: bootstrapped.users,
    sessions: bootstrapped.sessions.filter((session) => session.expiresAt > now),
  };
  if (cleaned.sessions.length !== bootstrapped.sessions.length || bootstrapped !== db) {
    await writeAuthDb(cleaned);
  }
  return cleaned;
}

async function writeAuthDb(db: AuthDb) {
  if (usePostgresRepository()) {
    await writeAuthDbPostgres(db);
    return;
  }
  await ensureDataDirs();
  await writeFile(authDbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function readAdminDb(): Promise<AdminDb> {
  if (usePostgresRepository()) return readAdminDbPostgres();
  await ensureDataDirs();
  let db: AdminDb;
  try {
    db = JSON.parse(await readFile(adminDbPath, "utf-8")) as AdminDb;
  } catch {
    db = defaultAdminDb();
    await writeAdminDb(db);
  }
  let secretMigrated = false;
  const providers = Array.isArray(db.providers)
    ? db.providers.map((provider) => {
        const normalized = normalizeProviderSecret(provider);
        if (normalized !== provider) secretMigrated = true;
        return normalized;
      })
    : [];
  const normalizedDb = {
    providers,
    models: Array.isArray(db.models) ? db.models : [],
    tasks: Array.isArray(db.tasks) ? db.tasks : [],
    auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs : [],
  };
  if (secretMigrated) await writeAdminDb(normalizedDb);
  return normalizedDb;
}

async function writeAdminDb(db: AdminDb) {
  if (usePostgresRepository()) {
    await writeAdminDbPostgres(db);
    return;
  }
  await ensureDataDirs();
  await writeFile(adminDbPath, JSON.stringify(db, null, 2), "utf-8");
}

function usePostgresRepository() {
  return storageDriver === "postgres" && Boolean(databaseUrl);
}

let postgresPoolPromise: Promise<import("pg").Pool> | null = null;
let redisClientPromise: Promise<import("redis").RedisClientType> | null = null;

async function getPostgresPool() {
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");
  postgresPoolPromise ??= import("pg").then((pg) => {
    const Pool = pg.Pool;
    return new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
      max: 5,
    });
  });
  return postgresPoolPromise;
}

async function readAuthDbPostgres(): Promise<AuthDb> {
  const pool = await getPostgresPool();
  const [usersResult, sessionsResult] = await Promise.all([
    pool.query(
      "select id, email, name, role, password_hash, disabled, created_at, updated_at from xh_users order by created_at asc",
    ),
    pool.query("select id, user_id, created_at, expires_at from xh_sessions order by created_at desc"),
  ]);
  const db: AuthDb = {
    users: usersResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role === "admin" ? "admin" : "member",
      passwordHash: row.password_hash,
      disabled: Boolean(row.disabled),
      createdAt: dateToMillis(row.created_at),
      updatedAt: dateToMillis(row.updated_at),
    })),
    sessions: sessionsResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: dateToMillis(row.created_at),
      expiresAt: dateToMillis(row.expires_at),
    })),
  };
  const bootstrapped = await ensureBootstrapUser(db);
  const now = Date.now();
  const cleaned: AuthDb = {
    users: bootstrapped.users,
    sessions: bootstrapped.sessions.filter((session) => session.expiresAt > now),
  };
  if (cleaned.sessions.length !== bootstrapped.sessions.length || bootstrapped !== db) {
    await writeAuthDbPostgres(cleaned);
  }
  return cleaned;
}

async function writeAuthDbPostgres(db: AuthDb) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from xh_sessions");
    await client.query("delete from xh_users");
    for (const user of db.users) {
      await client.query(
        `insert into xh_users (id, email, name, role, password_hash, disabled, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          user.email,
          user.name,
          user.role,
          user.passwordHash,
          Boolean(user.disabled),
          millisToDate(user.createdAt),
          millisToDate(user.updatedAt),
        ],
      );
    }
    for (const session of db.sessions) {
      await client.query(
        `insert into xh_sessions (id, user_id, created_at, expires_at)
         values ($1, $2, $3, $4)`,
        [session.id, session.userId, millisToDate(session.createdAt), millisToDate(session.expiresAt)],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function readAdminDbPostgres(): Promise<AdminDb> {
  const pool = await getPostgresPool();
  const [providersResult, modelsResult, tasksResult, auditResult] = await Promise.all([
    pool.query("select id, name, base_url, enabled, api_key_cipher, api_key_preview, note, created_at, updated_at from xh_providers order by created_at desc"),
    pool.query(
      "select id, provider_id, model_id, display_name, capability, enabled, input_profile, parameter_schema, created_at, updated_at from xh_models order by created_at desc",
    ),
    pool.query("select id, owner_id, title, status, provider_id, model_id, logs, created_at, updated_at from xh_tasks order by created_at desc"),
    pool.query(
      "select id, actor_id, actor_email, action, target_type, target_id, summary, created_at from xh_audit_logs order by created_at desc limit 500",
    ),
  ]);
  const db: AdminDb = {
    providers: providersResult.rows.map((row) =>
      normalizeProviderSecret({
        id: row.id,
        name: row.name,
        baseUrl: row.base_url || "",
        enabled: Boolean(row.enabled),
        apiKey: row.api_key_cipher || undefined,
        apiKeyPreview: row.api_key_preview || undefined,
        note: row.note || "",
        createdAt: dateToMillis(row.created_at),
        updatedAt: dateToMillis(row.updated_at),
      }),
    ),
    models: modelsResult.rows.map((row) => ({
      id: row.id,
      providerId: row.provider_id,
      modelId: row.model_id,
      displayName: row.display_name,
      capability: normalizeCapability(row.capability),
      enabled: Boolean(row.enabled),
      inputProfile: row.input_profile || "prompt",
      parameterSchema: JSON.stringify(row.parameter_schema || {}, null, 2),
      createdAt: dateToMillis(row.created_at),
      updatedAt: dateToMillis(row.updated_at),
    })),
    tasks: tasksResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: normalizeTaskStatus(row.status),
      ownerId: row.owner_id || undefined,
      providerId: row.provider_id || undefined,
      modelId: row.model_id || undefined,
      logs: Array.isArray(row.logs) ? row.logs.map((line: unknown) => safeText(line)).filter(Boolean) : [],
      createdAt: dateToMillis(row.created_at),
      updatedAt: dateToMillis(row.updated_at),
    })),
    auditLogs: auditResult.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id || "",
      actorEmail: row.actor_email,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      summary: row.summary,
      createdAt: dateToMillis(row.created_at),
    })),
  };
  if (db.providers.length === 0 && db.models.length === 0 && db.tasks.length === 0) {
    const seeded = defaultAdminDb();
    await writeAdminDbPostgres(seeded);
    return seeded;
  }
  return db;
}

async function writeAdminDbPostgres(db: AdminDb) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from xh_audit_logs");
    await client.query("delete from xh_tasks");
    await client.query("delete from xh_models");
    await client.query("delete from xh_providers");
    for (const provider of db.providers.map(normalizeProviderSecret)) {
      await client.query(
        `insert into xh_providers (id, name, base_url, enabled, api_key_cipher, api_key_preview, note, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          provider.id,
          provider.name,
          provider.baseUrl,
          provider.enabled,
          provider.apiKey || null,
          provider.apiKeyPreview || null,
          provider.note || null,
          millisToDate(provider.createdAt),
          millisToDate(provider.updatedAt),
        ],
      );
    }
    for (const model of db.models) {
      await client.query(
        `insert into xh_models (id, provider_id, model_id, display_name, capability, enabled, input_profile, parameter_schema, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
        [
          model.id,
          model.providerId,
          model.modelId,
          model.displayName,
          model.capability,
          model.enabled,
          model.inputProfile,
          JSON.stringify(parseJsonObject(model.parameterSchema)),
          millisToDate(model.createdAt),
          millisToDate(model.updatedAt),
        ],
      );
    }
    for (const task of db.tasks) {
      await client.query(
        `insert into xh_tasks (id, owner_id, title, status, provider_id, model_id, logs, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
        [
          task.id,
          task.ownerId || null,
          task.title,
          task.status,
          task.providerId || null,
          task.modelId || null,
          JSON.stringify(Array.isArray(task.logs) ? task.logs : []),
          millisToDate(task.createdAt),
          millisToDate(task.updatedAt),
        ],
      );
    }
    for (const audit of db.auditLogs || []) {
      await client.query(
        `insert into xh_audit_logs (id, actor_id, actor_email, action, target_type, target_id, summary, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          audit.id,
          audit.actorId || null,
          audit.actorEmail,
          audit.action,
          audit.targetType,
          audit.targetId,
          audit.summary,
          millisToDate(audit.createdAt),
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function millisToDate(value: number | undefined) {
  return new Date(typeof value === "number" && Number.isFinite(value) ? value : Date.now());
}

function dateToMillis(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : Date.now();
}

async function getRedisClient() {
  if (!redisUrl) throw new Error("REDIS_NOT_CONFIGURED");
  redisClientPromise ??= import("redis").then(async ({ createClient }) => {
    const client = createClient({ url: redisUrl });
    client.on("error", (error) => {
      console.error("xinghuan redis error", error instanceof Error ? error.message : String(error));
    });
    await client.connect();
    return client as import("redis").RedisClientType;
  });
  return redisClientPromise;
}

async function enqueueTask(taskId: string): Promise<{ queued: boolean; reason: string }> {
  if (!redisUrl) return { queued: false, reason: "redis_not_configured" };
  try {
    const client = await getRedisClient();
    await client.lPush(taskQueueName, taskId);
    return { queued: true, reason: "queued" };
  } catch (error) {
    return { queued: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function defaultAdminDb(): AdminDb {
  const now = Date.now();
  return {
    providers: [
      {
        id: "grsai",
        name: "GRSAI",
        baseUrl: "https://api.grsai.com",
        enabled: false,
        note: "图像模型测试服务商",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "toapis",
        name: "ToAPIs",
        baseUrl: "https://api.toapis.com",
        enabled: false,
        note: "视频模型测试服务商",
        createdAt: now,
        updatedAt: now,
      },
    ],
    models: [
      {
        id: "grsai-gpt-image-2",
        providerId: "grsai",
        modelId: "gpt-image-2",
        displayName: "GRSAI gpt-image-2",
        capability: "image",
        enabled: false,
        inputProfile: "prompt,image_reference",
        parameterSchema: JSON.stringify({ prompt: { type: "string", required: true } }, null, 2),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "toapis-grok-video",
        providerId: "toapis",
        modelId: "grok-video",
        displayName: "ToAPIs Grok Video",
        capability: "video",
        enabled: false,
        inputProfile: "prompt,first_frame,last_frame",
        parameterSchema: JSON.stringify({ prompt: { type: "string", required: true }, duration: { type: "number" } }, null, 2),
        createdAt: now,
        updatedAt: now,
      },
    ],
    tasks: [
      {
        id: `task-${now}-seed`,
        title: "后台任务系统占位验收",
        status: "queued",
        logs: ["任务队列骨架已创建，等待 worker 接入"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    auditLogs: [],
  };
}

async function ensureBootstrapUser(db: AuthDb): Promise<AuthDb> {
  const email = safeText(process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL, "admin@xinghuan.local").toLowerCase();
  const password =
    process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ||
    (environment === "local" ? "admin123456" : "");
  const now = Date.now();
  const users = [...db.users];
  let changed = false;
  if (password && !users.some((user) => user.email.toLowerCase() === email)) {
    users.push({
      id: "usr-admin",
      email,
      name: safeText(process.env.XINGHUAN_BOOTSTRAP_ADMIN_NAME, "星幻管理员"),
      role: "admin",
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  }
  const memberEmail = safeText(process.env.XINGHUAN_BOOTSTRAP_MEMBER_EMAIL, "member@xinghuan.local").toLowerCase();
  const memberPassword =
    process.env.XINGHUAN_BOOTSTRAP_MEMBER_PASSWORD ||
    (environment === "local" ? "member123456" : "");
  if (memberPassword && !users.some((user) => user.email.toLowerCase() === memberEmail)) {
    users.push({
      id: "usr-member",
      email: memberEmail,
      name: safeText(process.env.XINGHUAN_BOOTSTRAP_MEMBER_NAME, "星幻成员"),
      role: "member",
      passwordHash: hashPassword(memberPassword),
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  }
  return changed ? {
    ...db,
    users,
  } : db;
}

async function loginUser(emailValue: unknown, passwordValue: unknown) {
  const email = safeText(emailValue).toLowerCase();
  const password = String(passwordValue || "");
  if (!email || !password) return null;
  const db = await readAuthDb();
  const user = db.users.find((item) => item.email.toLowerCase() === email && !item.disabled);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  const now = Date.now();
  const session: SessionRecord = {
    id: randomToken(32),
    userId: user.id,
    createdAt: now,
    expiresAt: now + sessionTtlMs,
  };
  await writeAuthDb({ ...db, sessions: [session, ...db.sessions.filter((item) => item.userId !== user.id)] });
  return { user, session };
}

async function logoutUser(request: import("node:http").IncomingMessage) {
  const sessionId = readCookie(request, sessionCookieName);
  if (!sessionId) return;
  const db = await readAuthDb();
  await writeAuthDb({ ...db, sessions: db.sessions.filter((session) => session.id !== sessionId) });
}

async function getCurrentUser(request: import("node:http").IncomingMessage): Promise<CurrentUser | null> {
  const sessionId = readCookie(request, sessionCookieName);
  if (!sessionId) return null;
  const db = await readAuthDb();
  const session = db.sessions.find((item) => item.id === sessionId && item.expiresAt > Date.now());
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId && !item.disabled);
  return user ? toPublicUser(user) : null;
}

function toPublicUser(user: UserRecord): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function hashPassword(password: string) {
  const salt = randomToken(16);
  const key = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

function verifyPassword(password: string, encoded: string) {
  const [, salt, key] = encoded.split("$");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function readCookie(request: import("node:http").IncomingMessage, name: string) {
  const raw = request.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function buildSessionCookie(request: import("node:http").IncomingMessage, sessionId: string) {
  return `${sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(sessionTtlMs / 1000)}${isSecureRequest(request) ? "; Secure" : ""}`;
}

function expireSessionCookie(request: import("node:http").IncomingMessage) {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecureRequest(request) ? "; Secure" : ""}`;
}

function isSecureRequest(request: import("node:http").IncomingMessage) {
  return request.headers["x-forwarded-proto"] === "https";
}

function randomToken(byteLength: number) {
  return randomBytes(byteLength).toString("hex");
}

function defaultSettings() {
  return {
    zhenzhenApiKey: "",
    zhenzhenBaseUrl: "",
    rhApiKey: "",
    rhBaseUrl: "",
    llmApiKey: "",
    llmBaseUrl: "",
    fileSavePath: "",
    canvasAutoSavePath: "",
    resourceLibraryPath: "",
    themeTemplatePath: "",
    eagleApiBase: "",
    advancedProviders: [],
    advancedProviderSummary: { enabledCount: 0, totalCount: 0 },
    cloudUploadTargets: [],
    cloudUploadSummary: { enabledCount: 0, totalCount: 0 },
    preferences: { theme: "dark", language: "zh-CN" },
  };
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 240);
}

function safeEmail(value: unknown) {
  const email = safeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function safeSlug(value: unknown, fallback = "item") {
  return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || fallback;
}

function safeJsonText(value: unknown, fallback = "{}") {
  const text = String(value ?? fallback).trim() || fallback;
  try {
    JSON.parse(text);
    return text;
  } catch {
    return fallback;
  }
}

function safeFilename(value: unknown, fallback = "file") {
  const base = basename(String(value || fallback)).replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
  return base || fallback;
}

function safeUserId(value: unknown) {
  return String(value || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
}

function inferMime(filename: string) {
  const ext = extname(filename).toLowerCase();
  if ([".html"].includes(ext)) return "text/html; charset=utf-8";
  if ([".js", ".mjs"].includes(ext)) return "text/javascript; charset=utf-8";
  if ([".css"].includes(ext)) return "text/css; charset=utf-8";
  if ([".json"].includes(ext)) return "application/json; charset=utf-8";
  if ([".svg"].includes(ext)) return "image/svg+xml";
  if ([".txt"].includes(ext)) return "text/plain; charset=utf-8";
  if ([".png"].includes(ext)) return "image/png";
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if ([".webp"].includes(ext)) return "image/webp";
  if ([".gif"].includes(ext)) return "image/gif";
  if ([".mp4"].includes(ext)) return "video/mp4";
  if ([".webm"].includes(ext)) return "video/webm";
  if ([".mp3"].includes(ext)) return "audio/mpeg";
  if ([".wav"].includes(ext)) return "audio/wav";
  if ([".mid", ".midi"].includes(ext)) return "audio/midi";
  if ([".woff"].includes(ext)) return "font/woff";
  if ([".woff2"].includes(ext)) return "font/woff2";
  return "application/octet-stream";
}

function normalizeResourceKind(value: unknown): ResourceKind | "" {
  const kind = String(value || "").toLowerCase();
  return ["image", "video", "audio", "set", "pose", "workflow"].includes(kind) ? (kind as ResourceKind) : "";
}

function normalizeCapability(value: unknown): ModelCapability {
  const capability = String(value || "").toLowerCase();
  return ["text", "image", "video", "audio"].includes(capability) ? (capability as ModelCapability) : "image";
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  const status = String(value || "").toLowerCase();
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? (status as TaskStatus) : "queued";
}

function toAdminUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    disabled: Boolean(user.disabled),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toPublicProvider(provider: AdminProviderRecord) {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    enabled: provider.enabled,
    hasApiKey: Boolean(provider.apiKey),
    apiKeyPreview: provider.apiKeyPreview || secretPreview(decryptSecret(provider.apiKey || "")),
    note: provider.note || "",
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function normalizeProviderSecret(provider: AdminProviderRecord) {
  if (!provider.apiKey) return provider;
  if (provider.apiKey.startsWith("enc:v1:")) {
    return provider.apiKeyPreview ? provider : { ...provider, apiKeyPreview: secretPreview(decryptSecret(provider.apiKey)) };
  }
  const raw = provider.apiKey;
  return {
    ...provider,
    apiKey: encryptSecret(raw),
    apiKeyPreview: secretPreview(raw),
  };
}

function secretPreview(value: string) {
  return value ? `...${value.slice(-4)}` : "";
}

function encryptSecret(value: string) {
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string) {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value;
  try {
    const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf-8");
  } catch {
    return "";
  }
}

function secretKey() {
  const source =
    process.env.XINGHUAN_SECRET_KEY ||
    process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ||
    (environment === "local" ? "xinghuan-local-admin-secret" : "");
  return createHash("sha256").update(source || "xinghuan-fallback-secret").digest();
}

async function appendAudit(
  actor: CurrentUser,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
) {
  const db = await readAdminDb();
  const record: AdminAuditRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    targetType,
    targetId,
    summary,
    createdAt: Date.now(),
  };
  await writeAdminDb({
    ...db,
    auditLogs: [record, ...(db.auditLogs || [])].slice(0, 1000),
  });
}

async function readStorageStats() {
  const userIds = await readdir(usersDir).catch(() => []);
  let canvases = 0;
  let resources = 0;
  let inputFiles = 0;
  let outputFiles = 0;
  for (const userId of userIds) {
    const baseUser: CurrentUser = { id: userId, email: "", name: "", role: "member" };
    const dirs = userDataDirs(baseUser);
    const canvasList = await readJsonFile<CanvasListItem[]>(dirs.canvasListPath, []);
    canvases += Array.isArray(canvasList) ? canvasList.length : 0;
    const resourceDb = await readJsonFile<ResourceDb>(dirs.resourceDbPath, { categories: [], items: [] });
    resources += Array.isArray(resourceDb.items) ? resourceDb.items.length : 0;
    inputFiles += (await readdir(dirs.inputDir).catch(() => [])).length;
    outputFiles += (await readdir(dirs.outputDir).catch(() => [])).length;
  }
  return { users: userIds.length, canvases, resources, inputFiles, outputFiles };
}

async function readDatabaseStatus() {
  if (!databaseUrl) {
    return {
      configured: false,
      status: "not_configured",
      migrations: [] as string[],
      error: "",
    };
  }
  let pg: typeof import("pg");
  try {
    pg = await import("pg");
  } catch (error) {
    return {
      configured: true,
      status: "driver_missing",
      migrations: [] as string[],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    const now = await client.query("select now() as now");
    const migrations = await client
      .query("select id from xh_schema_migrations order by id")
      .then((result) => result.rows.map((row) => String(row.id)))
      .catch(() => []);
    return {
      configured: true,
      status: "connected",
      serverTime: now.rows[0]?.now,
      migrations,
      error: "",
    };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      migrations: [] as string[],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function readRedisStatus() {
  if (!redisUrl) {
    return {
      configured: false,
      status: "not_configured",
      queue: taskQueueName,
      depth: 0,
      error: "",
    };
  }
  try {
    const client = await getRedisClient();
    const pong = await client.ping();
    const depth = await client.lLen(taskQueueName);
    return {
      configured: true,
      status: pong === "PONG" ? "connected" : "unknown",
      queue: taskQueueName,
      depth,
      error: "",
    };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      queue: taskQueueName,
      depth: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function sendStaticFile(response: import("node:http").ServerResponse, baseDir: string, rawRel: string) {
  const sent = await trySendStaticFile(response, baseDir, rawRel);
  if (!sent) {
    sendJson(response, { ok: false, success: false, error: "FILE_NOT_FOUND" }, 404);
  }
}

async function trySendStaticFile(response: import("node:http").ServerResponse, baseDir: string, rawRel: string) {
  const base = resolve(baseDir);
  const target = resolve(base, decodeURIComponent(rawRel));
  if (target !== base && !target.startsWith(`${base}\\`) && !target.startsWith(`${base}/`)) {
    sendJson(response, { ok: false, success: false, error: "INVALID_PATH" }, 400);
    return true;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("not file");
    response.writeHead(200, {
      "content-type": inferMime(target),
      "content-length": String(info.size),
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    });
    createReadStream(target).pipe(response);
    return true;
  } catch {
    return false;
  }
}

async function sendWebAsset(response: import("node:http").ServerResponse, pathname: string) {
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/files/") ||
    pathname.startsWith("/input/") ||
    pathname.startsWith("/output/")
  ) {
    return false;
  }

  const webDistDir = await findWebDistDir();
  if (!webDistDir) return false;

  const assetRel = pathname === "/" ? "index.html" : pathname.slice(1);
  if (await trySendStaticFile(response, webDistDir, assetRel)) return true;
  if (pathname.startsWith("/assets/")) return false;
  return trySendStaticFile(response, webDistDir, "index.html");
}

async function sendAdminAsset(response: import("node:http").ServerResponse, pathname: string) {
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return false;

  const adminDistDir = await findAdminDistDir();
  if (!adminDistDir) return false;

  const assetRel = pathname === "/admin" || pathname === "/admin/" ? "index.html" : pathname.slice("/admin/".length);
  if (await trySendStaticFile(response, adminDistDir, assetRel)) return true;
  if (pathname.startsWith("/admin/assets/")) return false;
  return trySendStaticFile(response, adminDistDir, "index.html");
}

async function findWebDistDir() {
  for (const candidate of webDistCandidates) {
    try {
      const indexInfo = await stat(join(candidate, "index.html"));
      if (indexInfo.isFile()) return candidate;
    } catch {
      // Continue to the next candidate.
    }
  }
  return "";
}

async function findAdminDistDir() {
  for (const candidate of adminDistCandidates) {
    try {
      const indexInfo = await stat(join(candidate, "index.html"));
      if (indexInfo.isFile()) return candidate;
    } catch {
      // Continue to the next candidate.
    }
  }
  return "";
}

async function handleMultipartUpload(request: import("node:http").IncomingMessage, user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  return new Promise((resolveUpload, rejectUpload) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: { fileSize: 100 * 1024 * 1024, files: 1 },
    });
    let saved: { filename: string; url: string; size: number; mime: string } | null = null;
    busboy.on("file", (_name, file, info) => {
      const ext = extname(info.filename || "") || ".bin";
      const filename = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      const target = join(dirs.inputDir, filename);
      let size = 0;
      file.on("data", (chunk: Buffer) => {
        size += chunk.length;
      });
      file.pipe(createWriteStream(target));
      file.on("end", () => {
        saved = {
          filename,
          url: `/files/input/${filename}`,
          size,
          mime: info.mimeType || inferMime(filename),
        };
      });
    });
    busboy.on("error", rejectUpload);
    busboy.on("finish", () => {
      if (!saved) {
        rejectUpload(new Error("未收到文件"));
        return;
      }
      resolveUpload(saved);
    });
    request.pipe(busboy);
  });
}

async function saveBase64File(body: { dataUrl?: string; prefix?: string }, user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(body.dataUrl || "");
  if (!match) throw new Error("dataUrl 格式不支持");
  const ext = match[1].includes("jpeg") || match[1].includes("jpg") ? "jpg" : match[1].split("/")[1];
  const filename = `${safeFilename(body.prefix, "draw")}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(match[2], "base64");
  await writeFile(join(dirs.outputDir, filename), buffer);
  return { filename, url: `/files/output/${filename}`, size: buffer.length, mime: match[1] };
}

async function listOutputFiles(user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(dirs.outputDir).catch(() => []);
  const files = [];
  for (const name of names) {
    const info = await stat(join(dirs.outputDir, name)).catch(() => null);
    if (!info?.isFile()) continue;
    files.push({ filename: name, url: `/files/output/${name}`, size: info.size, mtime: info.mtimeMs });
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

async function saveToOutput(body: { url?: string; filename?: string }, user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  const url = safeText(body.url);
  if (!url) throw new Error("缺少 url");
  const filename = safeFilename(body.filename || basename(url), `out_${Date.now()}`);
  const target = join(dirs.outputDir, filename);
  if (url.startsWith("/files/input/")) {
    await copyFile(join(dirs.inputDir, decodeURIComponent(url.slice("/files/input/".length))), target);
    return { path: target, exist: false, source: "input" };
  }
  if (url.startsWith("/files/output/")) {
    await copyFile(join(dirs.outputDir, decodeURIComponent(url.slice("/files/output/".length))), target);
    return { path: target, exist: false, source: "output" };
  }
  throw new Error("暂不支持保存远程 URL");
}

async function readResourceDb(user: CurrentUser): Promise<ResourceDb> {
  await ensureDataDirs(user);
  try {
    return JSON.parse(await readFile(userDataDirs(user).resourceDbPath, "utf-8")) as ResourceDb;
  } catch {
    return { categories: [], items: [] };
  }
}

async function writeResourceDb(db: ResourceDb, user: CurrentUser) {
  await ensureDataDirs(user);
  await writeFile(userDataDirs(user).resourceDbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function addResourceFromPayload(raw: unknown, user: CurrentUser, forcedKind?: ResourceKind) {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = forcedKind || normalizeResourceKind(payload.kind) || "image";
  const now = Date.now();
  const url = safeText(payload.url);
  const item: ResourceItem = {
    id: `res-${now}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title: safeText(payload.title, url ? basename(url) : kind === "set" ? "素材集" : "资源"),
    url,
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
  };
  const db = await readResourceDb(user);
  db.items.unshift(item);
  await writeResourceDb(db, user);
  return item;
}

function pickResourcePatch(patch: Partial<ResourceItem>) {
  return {
    ...(patch.title !== undefined ? { title: safeText(patch.title) } : {}),
    ...(patch.categoryId !== undefined ? { categoryId: safeText(patch.categoryId) } : {}),
    ...(patch.tags !== undefined && Array.isArray(patch.tags)
      ? { tags: patch.tags.map((tag) => safeText(tag)).filter(Boolean) }
      : {}),
    ...(patch.favorite !== undefined ? { favorite: Boolean(patch.favorite) } : {}),
  };
}
