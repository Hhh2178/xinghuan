import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("canvas run migration", () => {
  it("creates an owner-scoped idempotent canvas run authority table", async () => {
    const sql = await readFile(new URL("../db/026_canvas_agent_runtime.sql", import.meta.url), "utf8");

    expect(sql).toMatch(/create table if not exists xh_canvas_runs/i);
    expect(sql).toMatch(/owner_id text not null references xh_users/i);
    expect(sql).toMatch(/canvas_id text not null references xh_canvases/i);
    expect(sql).toMatch(/canvas_revision bigint not null/i);
    expect(sql).toMatch(/plan_snapshot jsonb not null/i);
    expect(sql).toMatch(/configuration_snapshot jsonb not null/i);
    expect(sql).toMatch(/budget_snapshot jsonb not null/i);
    expect(sql).toMatch(/event_sequence bigint not null default 0/i);
    expect(sql).toMatch(/unique\s*\(owner_id, idempotency_key\)/i);
    expect(sql).toMatch(/'draft'.*'planning'.*'awaiting_approval'.*'queued'.*'running'.*'paused'.*'succeeded'.*'failed'.*'cancelled'/is);
  });

  it("creates step, event, and attempt ledgers with stable run relationships", async () => {
    const sql = await readFile(new URL("../db/026_canvas_agent_runtime.sql", import.meta.url), "utf8");

    expect(sql).toMatch(/create table if not exists xh_canvas_run_steps/i);
    expect(sql).toMatch(/run_id text not null references xh_canvas_runs\(id\) on delete cascade/i);
    expect(sql).toMatch(/unique\s*\(run_id, step_key\)/i);
    expect(sql).toMatch(/create table if not exists xh_canvas_run_events/i);
    expect(sql).toMatch(/unique\s*\(run_id, sequence\)/i);
    expect(sql).toMatch(/create table if not exists xh_task_attempts/i);
    expect(sql).toMatch(/unique\s*\(run_step_id, attempt_no\)/i);
    expect(sql).toMatch(/unique\s*\(owner_id, idempotency_key\)/i);
  });

  it("creates idempotent command and owner-scoped approval ledgers", async () => {
    const sql = await readFile(new URL("../db/026_canvas_agent_runtime.sql", import.meta.url), "utf8");

    expect(sql).toMatch(/create table if not exists xh_canvas_run_commands/i);
    expect(sql).toMatch(/command_type text not null check.*'start'.*'pause'.*'resume'.*'cancel'.*'retry'/is);
    expect(sql).toMatch(/unique\s*\(owner_id, idempotency_key\)/i);
    expect(sql).toMatch(/create table if not exists xh_agent_approvals/i);
    expect(sql).toMatch(/owner_id text not null references xh_users/i);
    expect(sql).toMatch(/status text not null check.*'pending'.*'approved'.*'rejected'.*'expired'.*'cancelled'/is);
  });

  it("adds an immutable workflow input snapshot to canvas runs", async () => {
    const sql = await readFile(new URL("../db/036_workflow_input_snapshots.sql", import.meta.url), "utf8");

    expect(sql).toMatch(/alter table xh_canvas_runs/i);
    expect(sql).toMatch(/add column if not exists input_snapshot jsonb not null default '\{\}'::jsonb/i);
  });

  it("adds workflow run identity and one-active-run isolation", async () => {
    const sql = await readFile(new URL("../db/037_workflow_region_runs.sql", import.meta.url), "utf8");

    expect(sql).toMatch(/add column if not exists workflow_id text/i);
    expect(sql).toMatch(/add column if not exists workflow_revision bigint/i);
    expect(sql).toMatch(/add column if not exists workflow_subgraph_hash text/i);
    expect(sql).toMatch(/run_scope in \('canvas', 'group', 'downstream', 'workflow'\)/i);
    expect(sql).toMatch(/create unique index if not exists uq_xh_canvas_runs_active_workflow/i);
    expect(sql).toMatch(/owner_id, canvas_id, workflow_id/i);
    expect(sql).toMatch(/status in \('planning', 'awaiting_approval', 'queued', 'running', 'paused'\)/i);
  });

  it("stores owner and workflow isolated remembered supervision settings", async () => {
    const sql = await readFile(new URL("../db/038_workflow_supervision_settings.sql", import.meta.url), "utf8");

    expect(sql).toMatch(/create table if not exists xh_workflow_supervision_settings/i);
    expect(sql).toMatch(/owner_id text not null references xh_users/i);
    expect(sql).toMatch(/canvas_id text not null references xh_canvases/i);
    expect(sql).toMatch(/workflow_id text not null/i);
    expect(sql).toMatch(/settings jsonb not null/i);
    expect(sql).toMatch(/unique\s*\(owner_id, canvas_id, workflow_id\)/i);
  });
});
