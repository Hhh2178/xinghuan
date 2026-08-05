interface AdminTaskListQuery {
  page: number;
  pageSize: number;
  status: string;
  providerId: string;
  capability: string;
}

interface AdminTaskListPage {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  filters: {
    status: string;
    providerId: string;
    capability: string;
  };
}

function toAdminTaskListSummary(task: any) {
  const source = task || {};
  const result = source.result && typeof source.result === "object" && !Array.isArray(source.result) ? source.result : {};
  const payload = source.payload && typeof source.payload === "object" && !Array.isArray(source.payload) ? source.payload : {};
  const providerPollRecoverable = source.status === "failed"
    && String(payload.taskCapability || result.capability || "").toLowerCase() === "video"
    && Boolean(String(result.upstreamTaskId || result.taskId || "").trim());
  const rawLogs = Array.isArray(source.logs) ? source.logs.map((line: unknown) => String(line)).filter(Boolean) : [];
  const { payload: _payload, result: _result, ...summary } = source;
  return {
    ...summary,
    outputRecoveryAvailable: summary.outputRecoveryAvailable ?? (
      result.outputRecoveryAvailable === true
      || result.outputRecoveryMode === "provider_poll_resume"
      || providerPollRecoverable
    ),
    materializationStatus: summary.materializationStatus || result.materializationStatus || undefined,
    failureCategory: summary.failureCategory || result.failureCategory || undefined,
    logs: rawLogs.length > 0 ? [rawLogs[rawLogs.length - 1]] : [],
    latestLog: String(source.latestLog || rawLogs[rawLogs.length - 1] || "").slice(0, 2000) || undefined,
    logCount: Number.isFinite(Number(source.logCount)) ? Math.max(0, Math.floor(Number(source.logCount))) : rawLogs.length,
  };
}

type SendT8 = (
  response: import("node:http").ServerResponse,
  data: unknown,
  statusCode?: number,
  headers?: Record<string, string>,
) => void;

type HttpErrorLike = new (statusCode: number, message: string, payload?: Record<string, unknown>) => Error;

export function parseAdminTaskListQuery(url: URL, deps: {
  clampInteger: (value: unknown, min: number, max: number, fallback: number) => number;
  safeText: (value: unknown, fallback?: string) => string;
}): AdminTaskListQuery {
  const { clampInteger, safeText } = deps;
  return {
    page: clampInteger(url.searchParams.get("page"), 1, 100000, 1),
    pageSize: clampInteger(url.searchParams.get("pageSize"), 1, 100, 20),
    status: safeText(url.searchParams.get("status")),
    providerId: safeText(url.searchParams.get("providerId")),
    capability: safeText(url.searchParams.get("capability")).toLowerCase(),
  };
}

export function createAdminTaskListRouteHandler(deps: {
  sendT8: SendT8;
  HttpError: HttpErrorLike;
  readAdminDb: () => Promise<{ tasks: any[] }>;
  readAuthDb: () => Promise<{ users: any[]; userGroups: any[] }>;
  readTaskListPage?: (query: AdminTaskListQuery) => Promise<AdminTaskListPage>;
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<any>;
  readJsonBody: <T>(request: import("node:http").IncomingMessage) => Promise<T>;
  appendAudit: (
    actor: any,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    context?: any,
  ) => Promise<void>;
  clampInteger: (value: unknown, min: number, max: number, fallback: number) => number;
  safeText: (value: unknown, fallback?: string) => string;
  plainObject: (value: unknown) => Record<string, unknown>;
  withUnifiedRuntimeDiagnostic: (task: any) => any;
  toAdminTaskRecord: (row: any) => any;
  enrichAdminTaskRecord: (task: any, usersById: Map<string, any>, groupsById: Map<string, any>) => any;
  normalizeTaskStatus: (value: unknown) => string;
  normalizeTaskQueueCapability: (value: unknown) => any;
  enqueueTask: (taskId: string, capability: any) => Promise<{ queued: boolean; reason: string; queueName: string }>;
  readTaskRecord: (taskId: string) => Promise<any | null>;
  insertTaskRecord: (task: any) => Promise<void>;
  appendTaskLog: (taskId: string, line: string) => Promise<void>;
  createRetriedTask: (task: any, options: { id: string; ownerId: string; now: number }) => any;
  cancelTaskWithStrategy: (taskId: string, actor: any) => Promise<{ task?: any | null } | null>;
  writeTaskRecord: (task: any) => Promise<void>;
  logApiEvent: (event: string, context: any, payload?: Record<string, unknown>) => void;
}) {
  const {
    sendT8,
    HttpError,
    readAdminDb,
    readAuthDb,
    readTaskListPage,
    usePostgresRepository,
    getPostgresPool,
    readJsonBody,
    appendAudit,
    clampInteger,
    safeText,
    plainObject,
    withUnifiedRuntimeDiagnostic,
    toAdminTaskRecord,
    enrichAdminTaskRecord,
    normalizeTaskStatus,
    normalizeTaskQueueCapability,
    enqueueTask,
    readTaskRecord,
    insertTaskRecord,
    appendTaskLog,
    createRetriedTask,
    cancelTaskWithStrategy,
    writeTaskRecord,
    logApiEvent,
  } = deps;

  function requireAdmin(currentUser: any) {
    if (!currentUser || currentUser.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED");
    }
    return currentUser;
  }

  async function readAdminTaskPage(query: AdminTaskListQuery): Promise<AdminTaskListPage> {
    if (usePostgresRepository()) {
      const pool = await getPostgresPool();
      const where: string[] = [];
      const params: unknown[] = [];
      if (query.status) {
        params.push(query.status);
        where.push(`t.status = $${params.length}`);
      }
      if (query.providerId) {
        params.push(query.providerId);
        where.push(`t.provider_id = $${params.length}`);
      }
      if (query.capability) {
        params.push(query.capability);
        where.push(`coalesce(t.payload->>'taskCapability', t.result->>'capability', t.result->'raw'->>'capability', '') = $${params.length}`);
      }
      const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
      const totalResult = await pool.query(`select count(*)::int as total from xh_tasks t ${whereSql}`, params);
      const total = Number(totalResult.rows?.[0]?.total || 0);
      const offset = (query.page - 1) * query.pageSize;
      const pageParams = [...params, query.pageSize, offset];
      const itemsResult = await pool.query(
        `select t.id,
                ${TASK_OWNER_ID_SQL} as owner_id,
                t.title,
                t.status,
                t.provider_id,
                t.execution_identity_snapshot,
                coalesce(nullif(t.execution_identity_snapshot->>'providerName', ''), p.name, t.provider_id, '') as provider_name,
                t.model_id,
                coalesce(nullif(t.execution_identity_snapshot->>'providerModelId', ''), m.model_id, t.model_id, '') as provider_model_id,
                coalesce(nullif(t.execution_identity_snapshot->>'modelName', ''), nullif(m.display_name, ''), m.model_id, t.model_id, '') as model_name,
                jsonb_array_length(coalesce(t.logs, '[]'::jsonb)) as log_count,
                (select value from jsonb_array_elements_text(coalesce(t.logs, '[]'::jsonb)) with ordinality as log(value, ordinal)
                  order by ordinal desc limit 1) as latest_log,
                t.created_at,
                t.updated_at,
                u.name as owner_name,
                u.email as owner_email,
                u.remark as owner_remark,
                u.group_id as owner_group_id,
                g.name as owner_group_name,
                case when ${TASK_OWNER_ID_SQL} is not null and u.id is null then true else false end as owner_deleted
         from xh_tasks t
         left join xh_users u on u.id = ${TASK_OWNER_ID_SQL}
         left join xh_user_groups g on g.id = u.group_id
         left join xh_providers p on p.id = t.provider_id
         left join xh_models m on m.id = t.model_id
         ${whereSql}
         order by t.created_at desc
         limit $${pageParams.length - 1} offset $${pageParams.length}`,
        pageParams,
      );
      const items = itemsResult.rows.map((row: any) => toAdminTaskListSummary(withUnifiedRuntimeDiagnostic(toAdminTaskRecord(row))));
      return {
        items,
        total,
        page: query.page,
        pageSize: query.pageSize,
        hasMore: offset + items.length < total,
        filters: {
          status: query.status,
          providerId: query.providerId,
          capability: query.capability,
        },
      };
    }

    const [db, authDb] = await Promise.all([readAdminDb(), readAuthDb()]);
    const usersById = new Map(authDb.users.map((user: any) => [user.id, user]));
    const groupsById = new Map(authDb.userGroups.map((group: any) => [group.id, group]));
    const filtered = db.tasks
      .filter((task: any) => {
        if (query.status && task.status !== query.status) return false;
        if (query.providerId && task.providerId !== query.providerId) return false;
        if (query.capability) {
          const resultRow = plainObject(task.result);
          const rawRow = plainObject(resultRow.raw);
          const taskCapability = safeText(task.payload?.taskCapability || resultRow.capability || rawRow.capability).toLowerCase();
          if (taskCapability !== query.capability) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((task: any) => toAdminTaskListSummary(withUnifiedRuntimeDiagnostic(enrichAdminTaskRecord(task, usersById, groupsById))));
    const total = filtered.length;
    const offset = (query.page - 1) * query.pageSize;
    const items = filtered.slice(offset, offset + query.pageSize);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: offset + items.length < total,
      filters: {
        status: query.status,
        providerId: query.providerId,
        capability: query.capability,
      },
    };
  }

  return async function handleAdminTaskListRoutes({
    request,
    response,
    url,
    currentUser,
    requestContext,
  }: {
    request: import("node:http").IncomingMessage;
    response: import("node:http").ServerResponse;
    url: URL;
    currentUser: any;
    requestContext?: any;
  }) {
    const actor = requireAdmin(currentUser);
    if (url.pathname === "/api/admin/tasks") {
      if (request.method === "GET") {
        await appendAudit(actor, "tasks.read", "task", "tasks-list", "查看任务列表", requestContext);
        const query = parseAdminTaskListQuery(url, { clampInteger, safeText });
        sendT8(response, readTaskListPage ? await readTaskListPage(query) : await readAdminTaskPage(query));
        return true;
      }

      if (request.method === "POST") {
        const body = await readJsonBody<any>(request);
        const now = Date.now();
        const task = {
          id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
          title: safeText(body.title, "后台任务"),
          status: normalizeTaskStatus(body.status),
          ownerId: safeText(body.ownerId, actor.id),
          providerId: safeText(body.providerId),
          modelId: safeText(body.modelId),
          payload: plainObject(body.payload),
          result: plainObject(body.result),
          logs: Array.isArray(body.logs) ? body.logs.map((line: unknown) => safeText(line)).filter(Boolean) : ["任务由后台创建"],
          createdAt: now,
          updatedAt: now,
        };
        await insertTaskRecord(task);
        const capability = normalizeTaskQueueCapability(task.payload?.taskCapability);
        const queueResult = task.status === "queued" && capability
          ? await enqueueTask(task.id, capability)
          : { queued: false, reason: task.status === "queued" ? "unsupported_capability" : "not_queued_status", queueName: "" };
        const queueLog = queueResult.queued ? `已进入 Redis 队列 ${queueResult.queueName}` : `未进入 Redis 队列: ${queueResult.reason}`;
        await appendTaskLog(task.id, queueLog);
        const queuedTask = {
          ...task,
          logs: [...task.logs, queueLog],
          updatedAt: Date.now(),
        };
        await appendAudit(actor, "task.create", "task", task.id, `创建任务 ${task.title}`, requestContext);
        logApiEvent("task.created", requestContext, {
          taskId: task.id,
          userId: actor.id,
          providerId: task.providerId,
          modelId: task.modelId,
          status: task.status,
        });
        sendT8(response, withUnifiedRuntimeDiagnostic((await readTaskRecord(task.id)) || queuedTask));
        return true;
      }
    }

    const retryMatch = url.pathname.match(/^\/api\/admin\/tasks\/([^/]+)\/retry$/);
    const recoverOutputMatch = url.pathname.match(/^\/api\/admin\/tasks\/([^/]+)\/recover-output$/);
    if (recoverOutputMatch && request.method === "POST") {
      const id = decodeURIComponent(recoverOutputMatch[1]);
      const currentTask = await readTaskRecord(id);
      if (!currentTask) throw new Error("任务不存在");
      if (currentTask.status !== "failed") throw new Error(`任务当前状态为 ${currentTask.status}，不可恢复产物`);
      const currentResult = plainObject(currentTask.result);
      const remoteUrls = [
        ...(Array.isArray(currentResult.remoteVideoUrls) ? currentResult.remoteVideoUrls : []),
        ...(Array.isArray(currentResult.remoteImageUrls) ? currentResult.remoteImageUrls : []),
        ...(Array.isArray(currentResult.remoteAudioUrls) ? currentResult.remoteAudioUrls : []),
      ].map((value) => safeText(value)).filter((value) => /^https?:\/\//i.test(value));
      const upstreamTaskId = safeText(currentResult.upstreamTaskId || currentResult.taskId);
      const capability = normalizeTaskQueueCapability(currentTask.payload?.taskCapability || currentResult.capability);
      const recoveryMode = remoteUrls.length > 0
        ? "output_only"
        : capability === "video" && upstreamTaskId
          ? "provider_poll_resume"
          : "";
      if (!recoveryMode) throw new Error("任务没有可恢复的 Provider 远程产物或上游任务号");
      const now = Date.now();
      const { finalizedAt: _finalizedAt, ...withoutFinalizedAt } = currentTask;
      const updated = {
        ...withoutFinalizedAt,
        status: "queued",
        payload: {
          ...plainObject(currentTask.payload),
          outputRecoveryMode: recoveryMode,
        },
        result: {
          ...currentResult,
          outputRecoveryMode: recoveryMode,
          upstreamTaskId: upstreamTaskId || undefined,
          outputRecoveryAvailable: true,
          materializationStatus: "queued",
          recoveryRequestedAt: new Date(now).toISOString(),
        },
        logs: [...(Array.isArray(currentTask.logs) ? currentTask.logs : []), recoveryMode === "provider_poll_resume"
          ? `管理员请求继续轮询上游任务 ${upstreamTaskId}（不重新生成、不重复计费）`
          : "管理员请求恢复已有产物（不重新生成、不重复计费）"],
        updatedAt: now,
      };
      await writeTaskRecord(updated);
      const queueResult = capability
        ? await enqueueTask(id, capability)
        : { queued: false, reason: "unsupported_capability", queueName: "" };
      const queueLog = queueResult.queued ? `产物恢复已进入 Redis 队列 ${queueResult.queueName}` : `产物恢复未进入 Redis 队列: ${queueResult.reason}`;
      await appendTaskLog(id, queueLog);
      await appendAudit(actor, "task.recover_output", "task", id, `恢复任务 ${currentTask.title} 的已有产物`, requestContext);
      logApiEvent("task.output_recovery_requested", requestContext, { taskId: id, capability, queued: queueResult.queued });
      sendT8(response, withUnifiedRuntimeDiagnostic((await readTaskRecord(id)) || { ...updated, logs: [...updated.logs, queueLog] }));
      return true;
    }

    if (retryMatch && request.method === "POST") {
      const id = decodeURIComponent(retryMatch[1]);
      const originalTask = await readTaskRecord(id);
      if (!originalTask) throw new Error("任务不存在");
      const now = Date.now();
      const retriedTask = createRetriedTask(originalTask, {
        id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
        ownerId: actor.id,
        now,
      });
      await insertTaskRecord(retriedTask);
      await appendTaskLog(id, `管理员发起重试，创建新任务 ${retriedTask.id}`);
      const capability = normalizeTaskQueueCapability(retriedTask.payload?.taskCapability);
      const queueResult = capability
        ? await enqueueTask(retriedTask.id, capability)
        : { queued: false, reason: "unsupported_capability", queueName: "" };
      const queueLog = queueResult.queued ? `已进入 Redis 队列 ${queueResult.queueName}` : `未进入 Redis 队列: ${queueResult.reason}`;
      await appendTaskLog(retriedTask.id, queueLog);
      await appendAudit(actor, "task.retry", "task", id, `重试任务 ${originalTask.title}，新任务 ${retriedTask.id}`, requestContext);
      sendT8(
        response,
        withUnifiedRuntimeDiagnostic((await readTaskRecord(retriedTask.id)) || { ...retriedTask, logs: [...retriedTask.logs, queueLog], updatedAt: Date.now() }),
      );
      return true;
    }

    const taskMatch = url.pathname.match(/^\/api\/admin\/tasks\/([^/]+)$/);
    const taskLogsMatch = url.pathname.match(/^\/api\/admin\/tasks\/([^/]+)\/logs$/);
    if (taskLogsMatch && request.method === "GET") {
      const id = decodeURIComponent(taskLogsMatch[1]);
      const task = await readTaskRecord(id);
      if (!task) throw new HttpError(404, "TASK_NOT_FOUND");
      const limit = clampInteger(url.searchParams.get("limit"), 1, 200, 50);
      const lines = Array.isArray(task.logs) ? task.logs.map((line: unknown) => String(line)).filter(Boolean) : [];
      const items = lines.slice(Math.max(0, lines.length - limit));
      await appendAudit(actor, "task.logs.read", "task", id, "查看任务日志", requestContext);
      sendT8(response, { items, total: lines.length, hasMore: items.length < lines.length });
      return true;
    }
    if (taskMatch && request.method === "GET") {
      const id = decodeURIComponent(taskMatch[1]);
      const task = await readTaskRecord(id);
      if (!task) throw new HttpError(404, "TASK_NOT_FOUND");
      await appendAudit(actor, "task.detail.read", "task", id, "查看任务详情", requestContext);
      sendT8(response, withUnifiedRuntimeDiagnostic(task));
      return true;
    }
    if (taskMatch && request.method === "PATCH") {
      const id = decodeURIComponent(taskMatch[1]);
      const body = await readJsonBody<any>(request);
      if (body.action === "cancel") {
        const cancelled = await cancelTaskWithStrategy(id, actor);
        const updated = cancelled?.task ?? null;
        if (!updated) throw new Error("任务不存在");
        await appendAudit(actor, "task.cancel", "task", id, `取消任务 ${updated.title}`, requestContext);
        sendT8(response, withUnifiedRuntimeDiagnostic(updated));
        return true;
      }
      if (body.status !== undefined) {
        throw new Error("任务状态不能直接修改，请使用取消或重试动作");
      }
      const currentTask = await readTaskRecord(id);
      if (!currentTask) throw new Error("任务不存在");
      const updated = {
        ...currentTask,
        title: body.title === undefined ? currentTask.title : safeText(body.title, currentTask.title),
        payload: body.payload === undefined ? currentTask.payload : plainObject(body.payload),
        result: body.result === undefined ? currentTask.result : plainObject(body.result),
        logs: body.logs === undefined ? currentTask.logs : body.logs.map((line: unknown) => safeText(line)).filter(Boolean),
        updatedAt: Date.now(),
      };
      await writeTaskRecord(updated);
      await appendAudit(actor, "task.update", "task", id, `更新任务 ${updated.title}`, requestContext);
      sendT8(response, withUnifiedRuntimeDiagnostic((await readTaskRecord(id)) || updated));
      return true;
    }

    return false;
  };
}
import { TASK_OWNER_ID_SQL } from "./task-owner-identity.js";
