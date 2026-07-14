import type { TaskStatus } from "@xinghuan/shared";
import type { Pool } from "pg";

import type { RunningHubKeyPoolItem } from "./worker-runninghub-dispatch.js";

export interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId: string;
  providerId: string;
  providerName: string;
  providerBaseUrl: string;
  providerProtocol: string;
  providerEnabled: boolean;
  apiKeyCipher: string;
  rhKeyPool: RunningHubKeyPoolItem[];
  modelRecordId: string;
  providerModelId: string;
  modelDisplayName: string;
  capability: string;
  modelEnabled: boolean;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  logs: string[];
}

export function createWorkerTaskStore(pool: Pool) {
  async function readTask(taskId: string): Promise<TaskRow | null> {
    const result = await pool.query(
      `select
         t.id,
         t.title,
         t.status,
         t.owner_id,
         t.provider_id as task_provider_id,
         t.model_id as task_model_id,
         t.payload,
         t.result,
         t.logs,
         p.id as provider_id,
         p.name as provider_name,
         p.base_url as provider_base_url,
         p.protocol as provider_protocol,
         p.enabled as provider_enabled,
         p.api_key_cipher,
         p.rh_key_pool,
         m.id as model_record_id,
         m.model_id as provider_model_id,
         m.display_name as model_display_name,
         m.capability,
         m.enabled as model_enabled,
         m.protocol_override
       from xh_tasks t
       left join xh_providers p on p.id = t.provider_id
       left join xh_models m on m.id = t.model_id
       where t.id = $1`,
      [taskId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      status: normalizeStatus(row.status),
      ownerId: row.owner_id || "",
      providerId: row.provider_id || row.task_provider_id || "",
      providerName: row.provider_name || "",
      providerBaseUrl: row.provider_base_url || "",
      providerProtocol: normalizeProtocol(row.protocol_override || row.provider_protocol),
      providerEnabled: row.provider_enabled === null || row.provider_enabled === undefined ? false : Boolean(row.provider_enabled),
      apiKeyCipher: row.api_key_cipher || "",
      rhKeyPool: normalizeRunningHubKeyPool(row.rh_key_pool),
      modelRecordId: row.model_record_id || row.task_model_id || "",
      providerModelId: row.provider_model_id || "",
      modelDisplayName: row.model_display_name || "",
      capability: normalizeCapability(row.capability || plainObject(row.payload).taskCapability || plainObject(row.result).capability),
      modelEnabled:
        normalizeProtocol(row.protocol_override || row.provider_protocol) === "runninghub"
          ? true
          : row.model_enabled === null || row.model_enabled === undefined
            ? false
            : Boolean(row.model_enabled),
      payload: plainObject(row.payload),
      result: plainObject(row.result),
      logs: Array.isArray(row.logs) ? row.logs.map((line: unknown) => String(line)).filter(Boolean) : [],
    };
  }

  async function updateTask(
    taskId: string,
    status: TaskStatus,
    newLogs: string[],
    resultPatch?: Record<string, unknown>,
    options?: { replaceResult: boolean },
  ): Promise<"updated" | "cancelled" | "missing"> {
    const task = await readTask(taskId);
    if (!task) return "missing";
    if (task.status === "cancelled" && status !== "cancelled") return "cancelled";
    const logs = [...task.logs, ...newLogs];
    const replaceResult = options?.replaceResult === true;
    const result = await pool.query(
      `update xh_tasks
       set status = $2,
           logs = $3::jsonb,
           result = ${replaceResult ? "$4::jsonb" : "coalesce(result, '{}'::jsonb) || $4::jsonb"},
           updated_at = now(),
           finalized_at = case
             when $2 in ('succeeded', 'failed', 'cancelled') then coalesce(finalized_at, now())
             else finalized_at
           end
       where id = $1
         and status <> 'cancelled'`,
      [taskId, status, JSON.stringify(logs), JSON.stringify(resultPatch || {})],
    );
    if (result.rowCount && result.rowCount > 0) return "updated";
    const latestTask = await readTask(taskId);
    if (!latestTask) return "missing";
    return latestTask.status === "cancelled" ? "cancelled" : "updated";
  }

  async function appendTaskLog(taskId: string, line: string) {
    await pool.query(
      `update xh_tasks
       set logs = coalesce(logs, '[]'::jsonb) || $2::jsonb,
           updated_at = now()
       where id = $1`,
      [taskId, JSON.stringify([line])],
    );
  }

  async function touchTaskRuntime(taskId: string, resultPatch: Record<string, unknown>) {
    await pool.query(
      `update xh_tasks
       set result = coalesce(result, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       where id = $1 and status = 'running'`,
      [taskId, JSON.stringify(resultPatch)],
    );
  }

  async function touchQueuedTaskRuntime(taskId: string, resultPatch: Record<string, unknown>) {
    await pool.query(
      `update xh_tasks
       set result = coalesce(result, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       where id = $1 and status = 'queued'`,
      [taskId, JSON.stringify(resultPatch)],
    );
  }

  async function isTaskCancelled(taskId: string) {
    const task = await readTask(taskId);
    return task?.status === "cancelled";
  }

  return {
    readTask,
    updateTask,
    appendTaskLog,
    touchTaskRuntime,
    touchQueuedTaskRuntime,
    isTaskCancelled,
  };
}

function normalizeStatus(value: unknown): TaskStatus {
  const status = String(value || "");
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? (status as TaskStatus) : "queued";
}

function normalizeCapability(value: unknown) {
  const capability = String(value || "").toLowerCase();
  if (capability === "text" || capability === "llm") return "chat";
  return ["chat", "image", "video", "audio"].includes(capability) ? capability : "";
}

function normalizeProtocol(value: unknown) {
  const protocol = String(value || "").toLowerCase();
  return ["openai", "gemini", "runninghub", "volcengine", "apimart", "modelscope", "custom", "grsai_draw"].includes(protocol)
    ? protocol
    : "openai";
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeRunningHubKeyPool(value: unknown): RunningHubKeyPoolItem[] {
  const normalized = (Array.isArray(value) ? value : [])
    .flatMap((item) => {
      const row = plainObject(item);
      const id = safeText(row.id);
      if (!id) return [];
      return [{
        id,
        note: safeText(row.note),
        apiKey: safeText(row.apiKey),
        apiKeyPreview: safeText(row.apiKeyPreview),
        maxConcurrency: Math.max(1, Number(row.maxConcurrency) || 1),
        enabled: row.enabled !== false,
        isDefault: row.isDefault === true,
        currentInFlight: Math.max(0, Number(row.currentInFlight) || 0),
      }];
    });
  const firstDefaultIndex = normalized.findIndex((item) => item.isDefault);
  return normalized.map((item, index) => ({
    ...item,
    isDefault: firstDefaultIndex >= 0 ? index === firstDefaultIndex : false,
  }));
}
