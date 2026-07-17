import type { Pool, QueryResultRow } from "pg";
import type { TaskStatus } from "@xinghuan/shared";
import { applyTaskFinalization, isTerminalTaskStatus } from "./task-lifecycle.js";
import { TASK_OWNER_ID_SQL } from "./task-owner-identity.js";

const TASK_LIST_WINDOW_LIMIT = 2000;

export interface TaskRecordShape {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  ownerDeleted?: boolean;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  displayStatus?: string;
  displayMessage?: string;
  displayTone?: "muted" | "warning" | "success" | "danger";
  runtimeStage?: string;
  providerState?: string;
}

export interface TaskOwnerRecordShape {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  passwordHash: string;
  groupId?: string;
  remark?: string;
  disabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TaskOwnerGroupRecordShape {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskListItemShape {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  ownerDeleted?: boolean;
  providerId?: string;
  modelId?: string;
  logs: string[];
  displayStatus?: string;
  displayMessage?: string;
  displayTone?: "muted" | "warning" | "success" | "danger";
  runtimeStage?: string;
  providerState?: string;
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
}

export interface TaskPostgresRowShape {
  id: string;
  title: string;
  status: string;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_remark?: string | null;
  owner_group_id?: string | null;
  owner_group_name?: string | null;
  owner_deleted?: unknown;
  provider_id?: string | null;
  model_id?: string | null;
  payload?: unknown;
  result?: unknown;
  logs?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  finalized_at?: unknown;
}

interface TaskListPostgresRow extends QueryResultRow, TaskPostgresRowShape {}
interface TaskDetailPostgresRow extends QueryResultRow, TaskPostgresRowShape {}
interface TaskCountPostgresRow extends QueryResultRow {
  total: unknown;
}

export interface TaskRepositoryDeps {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<Pool>;
  readTaskRecords: () => Promise<TaskRecordShape[]>;
  writeTaskRecords: (tasks: TaskRecordShape[]) => Promise<void>;
  readTaskOwnerRecords: () => Promise<{ users: TaskOwnerRecordShape[]; userGroups: TaskOwnerGroupRecordShape[] }>;
  toAdminTaskRecord: (row: TaskPostgresRowShape) => TaskRecordShape;
  enrichAdminTaskRecord: (
    task: TaskRecordShape,
    usersById: Map<string, TaskOwnerRecordShape>,
    groupsById: Map<string, TaskOwnerGroupRecordShape>,
  ) => TaskRecordShape;
  summarizeAdminTaskRecord: (task: TaskRecordShape) => TaskListItemShape;
  withUnifiedRuntimeDiagnostic: (task: TaskRecordShape) => TaskRecordShape;
  safeText: (value: unknown, fallback?: string) => string;
  plainObject: (value: unknown) => Record<string, unknown>;
  millisToDate: (value: number | undefined) => Date;
}

export interface TaskListQuery {
  page: number;
  pageSize: number;
  status: string;
  providerId: string;
  capability: string;
}

export interface TaskListPage {
  items: TaskListItemShape[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  windowLimit: number;
  windowSize: number;
  truncated: boolean;
  filters: {
    status: string;
    providerId: string;
    capability: string;
  };
}

export function createTaskRepository(deps: TaskRepositoryDeps) {
  return {
    appendTaskLog,
    insertTaskRecord,
    readTaskListPage,
    readTaskRecord,
    writeTaskRecord,
  };

  async function appendTaskLog(taskId: string, line: string) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        `update xh_tasks
         set logs = coalesce(logs, '[]'::jsonb) || $2::jsonb,
             updated_at = now()
         where id = $1`,
        [taskId, JSON.stringify([line])],
      );
      return;
    }
    const tasks = await deps.readTaskRecords();
    await deps.writeTaskRecords(
      tasks.map((task) =>
        task.id === taskId ? { ...task, logs: [...(Array.isArray(task.logs) ? task.logs : []), line], updatedAt: Date.now() } : task,
      ),
    );
  }

  async function insertTaskRecord(task: TaskRecordShape) {
    task = applyTaskFinalization(task, task.updatedAt);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        `insert into xh_tasks (id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at, finalized_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12)`,
        [
          task.id,
          task.ownerId || null,
          task.title,
          task.status,
          task.providerId || null,
          task.modelId || null,
          JSON.stringify(deps.plainObject(task.payload)),
          JSON.stringify(deps.plainObject(task.result)),
          JSON.stringify(Array.isArray(task.logs) ? task.logs : []),
          deps.millisToDate(task.createdAt),
          deps.millisToDate(task.updatedAt),
          task.finalizedAt ? deps.millisToDate(task.finalizedAt) : null,
        ],
      );
      return;
    }
    const tasks = await deps.readTaskRecords();
    await deps.writeTaskRecords([task, ...tasks]);
  }

  async function readTaskListPage(query: TaskListQuery): Promise<TaskListPage> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const where: string[] = [];
      const params: unknown[] = [];
      if (query.status) {
        params.push(query.status);
        where.push(`status = $${params.length}`);
      }
      if (query.providerId) {
        params.push(query.providerId);
        where.push(`provider_id = $${params.length}`);
      }
      if (query.capability) {
        params.push(query.capability);
        where.push(`coalesce(payload->>'taskCapability', result->>'capability', result->'raw'->>'capability', '') = $${params.length}`);
      }
      const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
      const windowResult = await pool.query<TaskCountPostgresRow>(`select count(*)::int as total from (select id from xh_tasks order by updated_at desc, created_at desc, id desc limit 2001) recent`, []);
      const windowCount = Number(windowResult.rows?.[0]?.total || 0);
      const totalResult = await pool.query<TaskCountPostgresRow>(`with recent_tasks as (select * from xh_tasks order by updated_at desc, created_at desc, id desc limit ${TASK_LIST_WINDOW_LIMIT}) select count(*)::int as total from recent_tasks ${whereSql}`, params);
      const total = Number(totalResult.rows?.[0]?.total || 0);
      const offset = (query.page - 1) * query.pageSize;
      const pageParams = [...params, query.pageSize, offset];
      const itemsResult = await pool.query<TaskListPostgresRow>(
        `with recent_tasks as (select * from xh_tasks order by updated_at desc, created_at desc, id desc limit ${TASK_LIST_WINDOW_LIMIT})
         select t.id,
                ${TASK_OWNER_ID_SQL} as owner_id,
                t.title,
                t.status,
                t.provider_id,
                t.model_id,
                t.logs,
                t.created_at,
                t.updated_at,
                t.finalized_at,
                u.name as owner_name,
                u.email as owner_email,
                u.remark as owner_remark,
                u.group_id as owner_group_id,
                g.name as owner_group_name,
                case when ${TASK_OWNER_ID_SQL} is not null and u.id is null then true else false end as owner_deleted
         from recent_tasks t
         left join xh_users u on u.id = ${TASK_OWNER_ID_SQL}
         left join xh_user_groups g on g.id = u.group_id
         ${whereSql}
         order by t.updated_at desc, t.created_at desc, t.id desc
         limit $${pageParams.length - 1} offset $${pageParams.length}`,
        pageParams,
      );
      const items = itemsResult.rows.map((row) =>
        toSafeTaskListItem(deps.summarizeAdminTaskRecord(deps.withUnifiedRuntimeDiagnostic(deps.toAdminTaskRecord(row)))),
      );
      return toTaskListPage(query, total, offset, items, Math.min(windowCount, TASK_LIST_WINDOW_LIMIT), windowCount > TASK_LIST_WINDOW_LIMIT);
    }

    const [tasks, owners] = await Promise.all([deps.readTaskRecords(), deps.readTaskOwnerRecords()]);
    const usersById = new Map(owners.users.map((user) => [user.id, user]));
    const groupsById = new Map(owners.userGroups.map((group) => [group.id, group]));
    const recentTasks = [...tasks]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || (b.createdAt || 0) - (a.createdAt || 0) || b.id.localeCompare(a.id))
      .slice(0, TASK_LIST_WINDOW_LIMIT);
    const filtered = recentTasks
      .filter((task) => taskMatchesQuery(task, query))
      .map((task) =>
        toSafeTaskListItem(deps.summarizeAdminTaskRecord(deps.withUnifiedRuntimeDiagnostic(deps.enrichAdminTaskRecord(task, usersById, groupsById)))),
      );
    const total = filtered.length;
    const offset = (query.page - 1) * query.pageSize;
    return toTaskListPage(query, total, offset, filtered.slice(offset, offset + query.pageSize), recentTasks.length, tasks.length > TASK_LIST_WINDOW_LIMIT);
  }

  async function readTaskRecord(taskId: string): Promise<TaskRecordShape | null> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<TaskDetailPostgresRow>(
        `select t.id,
                ${TASK_OWNER_ID_SQL} as owner_id,
                t.title,
                t.status,
                t.provider_id,
                t.model_id,
                t.payload,
                t.result,
                t.logs,
                t.created_at,
                t.updated_at,
                t.finalized_at,
                u.name as owner_name,
                u.email as owner_email,
                u.remark as owner_remark,
                u.group_id as owner_group_id,
                g.name as owner_group_name,
                case when ${TASK_OWNER_ID_SQL} is not null and u.id is null then true else false end as owner_deleted
         from xh_tasks t
         left join xh_users u on u.id = ${TASK_OWNER_ID_SQL}
         left join xh_user_groups g on g.id = u.group_id
         where t.id = $1
         limit 1`,
        [taskId],
      );
      return result.rows[0] ? deps.toAdminTaskRecord(result.rows[0]) : null;
    }
    const [tasks, owners] = await Promise.all([deps.readTaskRecords(), deps.readTaskOwnerRecords()]);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return null;
    return deps.enrichAdminTaskRecord(
      task,
      new Map(owners.users.map((user) => [user.id, user])),
      new Map(owners.userGroups.map((group) => [group.id, group])),
    );
  }

  async function writeTaskRecord(task: TaskRecordShape) {
    task = applyTaskFinalization(task, task.updatedAt);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        `update xh_tasks
         set owner_id = coalesce($2, owner_id),
             title = $3,
             status = $4,
             provider_id = $5,
             model_id = $6,
             payload = $7::jsonb,
             result = $8::jsonb,
             logs = $9::jsonb,
             updated_at = $10,
             finalized_at = $11
         where id = $1`,
        [
          task.id,
          task.ownerId || null,
          task.title,
          task.status,
          task.providerId || null,
          task.modelId || null,
          JSON.stringify(deps.plainObject(task.payload)),
          JSON.stringify(deps.plainObject(task.result)),
          JSON.stringify(Array.isArray(task.logs) ? task.logs : []),
          deps.millisToDate(task.updatedAt),
          task.finalizedAt ? deps.millisToDate(task.finalizedAt) : null,
        ],
      );
      return;
    }
    const tasks = await deps.readTaskRecords();
    await deps.writeTaskRecords(tasks.map((item) => (item.id === task.id ? { ...task, ownerId: task.ownerId || item.ownerId } : item)));
  }

  function taskMatchesQuery(task: TaskRecordShape, query: TaskListQuery) {
    if (query.status && task.status !== query.status) return false;
    if (query.providerId && task.providerId !== query.providerId) return false;
    if (query.capability) {
      const resultRow = deps.plainObject(task.result);
      const rawRow = deps.plainObject(resultRow.raw);
      const taskCapability = deps.safeText(task.payload?.taskCapability || resultRow.capability || rawRow.capability).toLowerCase();
      if (taskCapability !== query.capability) return false;
    }
    return true;
  }

  function toTaskListPage(query: TaskListQuery, total: number, offset: number, items: TaskListItemShape[], windowSize = total, truncated = false): TaskListPage {
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: offset + items.length < total,
      windowLimit: TASK_LIST_WINDOW_LIMIT,
      windowSize,
      truncated,
      filters: {
        status: query.status,
        providerId: query.providerId,
        capability: query.capability,
      },
    };
  }

  function toSafeTaskListItem(item: TaskListItemShape | (TaskListItemShape & Record<string, unknown>)): TaskListItemShape {
    const { payload: _payload, result: _result, ...summary } = item as TaskListItemShape & {
      payload?: unknown;
      result?: unknown;
    };
    return {
      ...summary,
      logs: Array.isArray(summary.logs) ? summary.logs.map((line) => String(line)).filter(Boolean) : [],
      finalizedAt: summary.finalizedAt || (isTerminalTaskStatus(summary.status) ? summary.updatedAt : undefined),
    };
  }
}
