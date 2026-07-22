import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCanvasRunCoordinator } from "./canvas-run-coordinator.js";
import { createWorkerTaskStore } from "./worker-task-store.js";

const databaseUrl = String(process.env.XINGHUAN_TEST_DATABASE_URL || "").trim();
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe("Canvas Run PostgreSQL integration", () => {
  const prefix = `canvas-agent-integration-${randomUUID()}`;
  const ownerIds: string[] = [];
  const providerId = `${prefix}-provider`;
  const modelId = `${prefix}-model`;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 5_000 });
    const database = await pool.query<{ database_name: string }>("select current_database() as database_name");
    expect(database.rows[0]?.database_name).toMatch(/^xinghuan_agent_test_[a-z0-9_]+$/);

    await pool.query("select 1 from xh_canvas_runs limit 1");
    await pool.query("select 1 from xh_canvas_run_dispatch_cursors limit 1");
    await pool.query(
      "insert into xh_providers (id, name, enabled) values ($1, $2, true)",
      [providerId, `${prefix} provider`],
    );
    await pool.query(
      "insert into xh_models (id, provider_id, model_id, display_name, capability, enabled) values ($1, $2, $3, $4, 'image', true)",
      [modelId, providerId, `${prefix}-model`, `${prefix} model`],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      if (ownerIds.length) {
        await pool.query("delete from xh_tasks where owner_id = any($1::text[])", [ownerIds]);
        await pool.query("delete from xh_users where id = any($1::text[])", [ownerIds]);
      }
      await pool.query("delete from xh_models where id = $1", [modelId]);
      await pool.query("delete from xh_providers where id = $1", [providerId]);
    } finally {
      await pool.end();
    }
  });

  it("allows only one queued-task delivery to claim execution", async () => {
    const ownerId = await ensureOwner("claim");
    const taskId = `${prefix}-duplicate-task`;
    await pool.query(
      "insert into xh_tasks (id, owner_id, title, status, payload, result, logs) values ($1, $2, $3, 'queued', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)",
      [taskId, ownerId, `${prefix} duplicate delivery`],
    );

    const store = createWorkerTaskStore(pool);
    const outcomes = await Promise.all(Array.from({ length: 8 }, (_, index) => store.claimQueuedTask(taskId, `integration claimant ${index}`)));

    expect(outcomes.filter((outcome) => outcome === "claimed")).toHaveLength(1);
    expect((await pool.query<{ status: string }>("select status from xh_tasks where id = $1", [taskId])).rows[0]?.status).toBe("running");
  });

  it("serializes two workers through the durable fairness cursor", async () => {
    const first = await createReadyStep("fair-a");
    const second = await createReadyStep("fair-b");
    const queue = createQueue();
    const workerA = createCanvasRunCoordinator({ pool, redis: queue.redis, workerId: `${prefix}-worker-a`, environment: "test", queueName: `${prefix}:tasks`, enabled: true });
    const workerB = createCanvasRunCoordinator({ pool, redis: queue.redis, workerId: `${prefix}-worker-b`, environment: "test", queueName: `${prefix}:tasks`, enabled: true });

    await Promise.all([workerA.tick(), workerB.tick()]);

    const claimed = await pool.query<{ id: string; owner_id: string; task_id: string | null }>(
      `select s.id, r.owner_id, s.task_id
       from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
       where s.id = any($1::text[]) order by r.owner_id`,
      [[first.stepId, second.stepId]],
    );
    expect(claimed.rows.map((row) => row.owner_id)).toEqual([first.ownerId, second.ownerId].sort());
    expect(claimed.rows.every((row) => Boolean(row.task_id))).toBe(true);
    expect(queue.pushes).toHaveLength(2);

    const cursor = await pool.query<{ last_owner_id: string }>(
      "select last_owner_id from xh_canvas_run_dispatch_cursors where scope = 'canvas-run-generation'",
    );
    expect(cursor.rows[0]?.last_owner_id).toBe([first.ownerId, second.ownerId].sort().at(-1));
  });

  it("takes over an expired step lease without duplicating its Generation Task", async () => {
    const expired = await createReadyStep("expired", true);
    const queue = createQueue();
    const workerId = `${prefix}-worker-takeover`;
    const worker = createCanvasRunCoordinator({ pool, redis: queue.redis, workerId, environment: "test", queueName: `${prefix}:tasks`, enabled: true });

    await worker.tick();

    const step = await pool.query<{ status: string; task_id: string | null; lease_owner: string | null }>(
      "select status, task_id, lease_owner from xh_canvas_run_steps where id = $1",
      [expired.stepId],
    );
    expect(step.rows[0]).toMatchObject({ status: "queued", lease_owner: workerId });
    expect(step.rows[0]?.task_id).toBeTruthy();
    expect(queue.pushes).toHaveLength(1);
  });

  it("recovers a committed task after the first queue delivery is interrupted", async () => {
    const interrupted = await createReadyStep("queue-recovery");
    const failingWorker = createCanvasRunCoordinator({
      pool,
      redis: { lPush: async () => { throw new Error("integration queue unavailable"); } } as any,
      workerId: `${prefix}-worker-failing-delivery`,
      environment: "test",
      queueName: `${prefix}:tasks`,
      enabled: true,
    });

    await expect(failingWorker.tick()).rejects.toThrow("integration queue unavailable");
    const persisted = await pool.query<{ task_id: string | null; dispatch_enqueued_at: Date | null }>(
      "select task_id, dispatch_enqueued_at from xh_canvas_run_steps where id = $1",
      [interrupted.stepId],
    );
    const taskId = persisted.rows[0]?.task_id;
    expect(taskId).toBeTruthy();
    expect(persisted.rows[0]?.dispatch_enqueued_at).toBeNull();

    const recoveredQueue = createQueue();
    const recoveryWorker = createCanvasRunCoordinator({ pool, redis: recoveredQueue.redis, workerId: `${prefix}-worker-recovery`, environment: "test", queueName: `${prefix}:tasks`, enabled: true });
    await recoveryWorker.tick();

    const recovered = await pool.query<{ dispatch_enqueued_at: Date | null }>(
      "select dispatch_enqueued_at from xh_canvas_run_steps where id = $1",
      [interrupted.stepId],
    );
    expect(recovered.rows[0]?.dispatch_enqueued_at).not.toBeNull();
    expect(recoveredQueue.pushes.map((entry) => entry.taskId)).toContain(taskId);
    expect((await pool.query("select id from xh_tasks where id = $1", [taskId])).rowCount).toBe(1);
  });

  async function ensureOwner(label: string) {
    const ownerId = `${prefix}-owner-${label}`;
    if (ownerIds.includes(ownerId)) return ownerId;
    await pool.query(
      "insert into xh_users (id, email, name, role, password_hash) values ($1, $2, $3, 'member', 'integration-only')",
      [ownerId, `${ownerId}@example.test`, `${prefix} ${label}`],
    );
    ownerIds.push(ownerId);
    return ownerId;
  }

  async function createReadyStep(label: string, expiredLease = false) {
    const ownerId = await ensureOwner(label);
    const canvasId = `${prefix}-canvas-${label}`;
    const runId = `${prefix}-run-${label}`;
    const stepId = `${prefix}-step-${label}`;
    const nodeId = `${prefix}-node-${label}`;
    const stepKey = `${prefix}-step-key-${label}`;
    const planSnapshot = {
      steps: [{
        id: stepKey,
        nodeId,
        configuration: {
          providerId,
          modelRecordId: modelId,
          modelId: `${prefix}-model`,
          taskCapability: "image",
          executionPayload: { prompt: `integration ${label}` },
        },
      }],
    };

    await pool.query("insert into xh_canvases (id, owner_id, name) values ($1, $2, $3)", [canvasId, ownerId, `${prefix} canvas ${label}`]);
    await pool.query(
      `insert into xh_canvas_runs
       (id, owner_id, canvas_id, canvas_revision, status, plan_snapshot, configuration_snapshot, budget_snapshot, idempotency_key)
       values ($1, $2, $3, 1, 'queued', $4::jsonb, '{}'::jsonb, '{}'::jsonb, $5)`,
      [runId, ownerId, canvasId, JSON.stringify(planSnapshot), `${prefix}-run-command-${label}`],
    );
    await pool.query(
      `insert into xh_canvas_run_steps
       (id, run_id, step_key, node_id, node_type, sequence, status, depends_on, input_binding, output_binding, error, lease_owner, lease_expires_at)
       values ($1, $2, $3, $4, 'image', 1, 'ready', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         case when $5 then 'expired-worker' else null end,
         case when $5 then now() - interval '1 minute' else null end)`,
      [stepId, runId, stepKey, nodeId, expiredLease],
    );
    return { ownerId, stepId };
  }
});

function createQueue() {
  const pushes: Array<{ queue: string; taskId: string }> = [];
  return {
    pushes,
    redis: {
      lPush: async (queue: string, taskId: string) => {
        pushes.push({ queue, taskId });
        return pushes.length;
      },
    } as any,
  };
}
