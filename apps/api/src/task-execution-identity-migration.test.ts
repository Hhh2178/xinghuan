import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../db/043_task_execution_identity_snapshot.sql", import.meta.url), "utf8");

describe("task execution identity migration", () => {
  it("adds and backfills the immutable identity snapshot", () => {
    expect(migration).toMatch(/add column if not exists execution_identity_snapshot jsonb not null default '\{\}'::jsonb/i);
    expect(migration).toMatch(/update xh_tasks t\s+set execution_identity_snapshot/i);
    expect(migration).toContain("'providerName'");
    expect(migration).toContain("'providerModelId'");
    expect(migration).toContain("'modelName'");
  });

  it("freezes identity on insert without rewriting existing snapshots", () => {
    expect(migration).toMatch(/create or replace function xh_freeze_task_execution_identity_snapshot/i);
    expect(migration).toMatch(/if coalesce\(new\.execution_identity_snapshot, '\{\}'::jsonb\) = '\{\}'::jsonb then/i);
    expect(migration).toMatch(/before insert on xh_tasks/i);
  });

  it("never copies Provider credentials into the snapshot", () => {
    expect(migration).not.toMatch(/api_key|cipher|secret|token|cookie|authorization/i);
  });
});
