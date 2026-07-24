import { describe, expect, it, vi } from "vitest";

import type { CanvasRunPlan } from "@xinghuan/agent-core";
import { createCanvasRunRepository } from "./canvas-run-repository.js";

const plan: CanvasRunPlan = {
  canvasId: "canvas-1",
  ownerId: "owner-1",
  canvasRevision: 4,
  groups: [{ id: "group-1", order: 0, skipped: false, stepIds: ["step:image", "step:video"] }],
  executionLayers: [{ index: 0, stepIds: ["step:image"] }, { index: 1, stepIds: ["step:video"] }],
  steps: [
    { id: "step:image", nodeId: "image", nodeType: "image", groupId: "group-1", dependsOn: [], skipped: false, executionLayer: 0 },
    { id: "step:video", nodeId: "video", nodeType: "video", groupId: "group-1", dependsOn: ["image"], skipped: false, executionLayer: 1 },
  ],
};

function runRow(status = "draft") {
  return {
    id: "canvas_run_1",
    owner_id: "owner-1",
    canvas_id: "canvas-1",
    canvas_revision: 4,
    run_scope: "canvas",
    status,
    plan_snapshot: plan,
    input_snapshot: { workflowId: "workflow-1" },
    configuration_snapshot: {},
    budget_snapshot: {},
    created_at_ms: 100,
    updated_at_ms: 200,
  };
}

function scriptedPool(handler: (sql: string, params: unknown[] | undefined) => Promise<{ rows: any[] }>) {
  const query = vi.fn(handler);
  const release = vi.fn();
  return { pool: { connect: async () => ({ query, release }), query } as any, query, release };
}

describe("canvas run repository", () => {
  it("creates an owner/revision locked run, steps, and first event in one transaction", async () => {
    const { pool, query, release } = scriptedPool(async (sql, params) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("select revision from xh_canvases")) {
        expect(sql).toContain("owner_id = $2 for share");
        expect(params).toEqual(["canvas-1", "owner-1"]);
        return { rows: [{ revision: 4 }] };
      }
      if (sql.includes("with inserted as")) {
        expect(sql).toContain("on conflict (owner_id, idempotency_key) do nothing");
        expect(sql).toContain("input_snapshot");
        expect(params?.slice(4, 8)).toEqual([null, null, null, "canvas"]);
        expect(params?.[9]).toBe(JSON.stringify({ workflowId: "workflow-1" }));
        return { rows: [runRow()] };
      }
      if (sql.includes("insert into xh_canvas_run_steps")) return { rows: [] };
      if (sql.includes("returning event_sequence")) return { rows: [{ event_sequence: 1 }] };
      if (sql.includes("insert into xh_canvas_run_events")) {
        expect(params?.[3]).toBe(1);
        return { rows: [] };
      }
      if (sql.includes("from xh_canvas_runs r where r.id")) return { rows: [runRow()] };
      throw new Error(`unexpected query: ${sql}`);
    });
    let id = 0;
    const repo = createCanvasRunRepository({ getPostgresPool: async () => pool, newId: (prefix) => `${prefix}_${++id}` });

    const result = await repo.createCanvasRun({ ownerId: "owner-1", idempotencyKey: "create-1", plan, inputSnapshot: { workflowId: "workflow-1" } });

    expect(result).toMatchObject({ created: true, run: { id: "canvas_run_1", ownerId: "owner-1", canvasRevision: 4, inputSnapshot: { workflowId: "workflow-1" } } });
    const stepCalls = query.mock.calls.filter(([sql]) => String(sql).includes("insert into xh_canvas_run_steps"));
    expect(stepCalls).toHaveLength(2);
    expect(stepCalls.map((call) => call[1]?.[7])).toEqual([0, 1]);
    expect(stepCalls.map((call) => call[1]?.[8])).toEqual(["ready", "blocked"]);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("from xh_canvas_runs r where r.id"))).toBe(true);
    expect(release).toHaveBeenCalledOnce();
  });

  it("returns the existing run for an owner-scoped idempotent create replay", async () => {
    const { pool } = scriptedPool(async (sql) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("select revision from xh_canvases")) return { rows: [{ revision: 4 }] };
      if (sql.includes("with inserted as")) return { rows: [] };
      if (sql.includes("idempotency_key = $2")) return { rows: [runRow()] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repo = createCanvasRunRepository({ getPostgresPool: async () => pool });

    await expect(repo.createCanvasRun({ ownerId: "owner-1", idempotencyKey: "create-1", plan })).resolves.toMatchObject({ created: false, run: { id: "canvas_run_1" } });
  });

  it("scopes reads to the authenticated owner", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      expect(sql).toContain("r.id = $1 and r.owner_id = $2");
      expect(params).toEqual(["canvas_run_1", "owner-2"]);
      return { rows: [] };
    });
    const repo = createCanvasRunRepository({ getPostgresPool: async () => ({ query } as any) });
    await expect(repo.readOwnedRun("owner-2", "canvas_run_1")).resolves.toBeNull();
  });

  it("serializes an idempotent pause command with a run lock and event", async () => {
    const paused = runRow("paused");
    const { pool, query } = scriptedPool(async (sql, params) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("from xh_canvas_run_commands") && sql.startsWith("select")) return { rows: [] };
      if (sql.includes("select status from xh_canvas_runs")) {
        expect(sql).toContain("owner_id = $2 for update");
        return { rows: [{ status: "running" }] };
      }
      if (sql.includes("set status = $3")) {
        expect(params).toEqual(["canvas_run_1", "owner-1", "paused"]);
        return { rows: [] };
      }
      if (sql.includes("returning event_sequence")) return { rows: [{ event_sequence: 2 }] };
      if (sql.includes("insert into xh_canvas_run_events")) return { rows: [] };
      if (sql.includes("insert into xh_canvas_run_commands")) return { rows: [] };
      if (sql.includes("from xh_canvas_runs r where r.id")) return { rows: [paused] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repo = createCanvasRunRepository({ getPostgresPool: async () => pool, newId: (prefix) => `${prefix}_1` });

    await expect(repo.applyCommand({ ownerId: "owner-1", runId: "canvas_run_1", command: "pause", idempotencyKey: "pause-1" })).resolves.toMatchObject({ status: "paused" });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("for update"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("insert into xh_canvas_run_commands"))).toBe(true);
  });

  it("rejects stale canvas revisions before creating a run", async () => {
    const { pool, query } = scriptedPool(async (sql) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("select revision from xh_canvases")) return { rows: [{ revision: 5 }] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repo = createCanvasRunRepository({ getPostgresPool: async () => pool });

    await expect(repo.createCanvasRun({ ownerId: "owner-1", idempotencyKey: "stale", plan })).rejects.toThrow("CANVAS_RUN_REVISION_CONFLICT");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("insert into xh_canvas_runs"))).toBe(false);
  });

  it("maps the active workflow uniqueness constraint to a stable domain conflict", async () => {
    const workflowPlan: CanvasRunPlan = {
      ...plan,
      workflowId: "workflow-1",
      workflowRevision: 3,
      workflowSubgraphHash: "a".repeat(64),
    };
    const { pool } = scriptedPool(async (sql) => {
      if (sql === "begin" || sql === "rollback") return { rows: [] };
      if (sql.includes("select revision from xh_canvases")) return { rows: [{ revision: 4 }] };
      if (sql.includes("with inserted as")) {
        throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: "uq_xh_canvas_runs_active_workflow" });
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repo = createCanvasRunRepository({ getPostgresPool: async () => pool });

    await expect(repo.createCanvasRun({ ownerId: "owner-1", idempotencyKey: "workflow-active", plan: workflowPlan }))
      .rejects.toThrow("WORKFLOW_RUN_ACTIVE_CONFLICT");
  });

  it("reads, writes, and resets remembered settings through owner-scoped workflow keys", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("select s.settings")) {
        expect(sql).toContain("c.owner_id = $1");
        expect(params).toEqual(["owner-1", "canvas-1", "workflow-1"]);
        return { rows: [{ settings: { defaultRetryCount: 4 }, revision: 2, updated_at_ms: 100 }] };
      }
      if (sql.includes("insert into xh_workflow_supervision_settings")) {
        expect(sql).toContain("on conflict (owner_id, canvas_id, workflow_id)");
        expect(params?.slice(1, 4)).toEqual(["owner-1", "canvas-1", "workflow-1"]);
        return { rows: [{ settings: { defaultRetryCount: 5 }, revision: 3, updated_at_ms: 200 }] };
      }
      if (sql.includes("delete from xh_workflow_supervision_settings")) {
        expect(sql).toContain("using xh_canvases");
        expect(params).toEqual(["owner-1", "canvas-1", "workflow-1"]);
        return { rows: [{ id: "setting-1" }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repo = createCanvasRunRepository({ getPostgresPool: async () => ({ query } as any), newId: () => "setting-1" });

    await expect(repo.readOwnedWorkflowSupervisionSettings("owner-1", "canvas-1", "workflow-1"))
      .resolves.toEqual({ settings: { defaultRetryCount: 4 }, revision: 2, updatedAt: 100 });
    await expect(repo.writeOwnedWorkflowSupervisionSettings({
      ownerId: "owner-1",
      canvasId: "canvas-1",
      workflowId: "workflow-1",
      settings: { defaultRetryCount: 5 },
    })).resolves.toEqual({ settings: { defaultRetryCount: 5 }, revision: 3, updatedAt: 200 });
    await expect(repo.deleteOwnedWorkflowSupervisionSettings("owner-1", "canvas-1", "workflow-1")).resolves.toBe(true);
  });

  it("lists the latest workflow run per target for a single owner and canvas", async () => {
    const row = { ...runRow("running"), workflow_id: "workflow-1", workflow_revision: 3, workflow_subgraph_hash: "a".repeat(64), run_scope: "workflow" };
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      expect(sql).toContain("distinct on (r.workflow_id)");
      expect(sql).toContain("r.owner_id = $1 and r.canvas_id = $2");
      expect(params).toEqual(["owner-1", "canvas-1", 50]);
      return { rows: [row] };
    });
    const repo = createCanvasRunRepository({ getPostgresPool: async () => ({ query } as any) });

    await expect(repo.readOwnedWorkflowRunOverview("owner-1", "canvas-1", 50))
      .resolves.toEqual([expect.objectContaining({ id: "canvas_run_1", workflowId: "workflow-1", status: "running" })]);
  });
});
