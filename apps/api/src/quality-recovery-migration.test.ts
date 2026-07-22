import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("artifact quality and recovery migration", () => {
  it("persists versioned profiles and owner-scoped evaluations", async () => {
    const sql = await readFile(new URL("../db/028_artifact_quality_and_recovery.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/create table if not exists xh_artifact_quality_profiles/i);
    expect(sql).toMatch(/media_kind text not null check \(media_kind in \('image', 'video'\)\)/i);
    expect(sql).toMatch(/create table if not exists xh_artifact_evaluations/i);
    expect(sql).toMatch(/artifact_id text not null references xh_generation_artifacts/i);
    expect(sql).toMatch(/overall_score numeric.*between 0 and 100/i);
    expect(sql).toMatch(/unique\s*\(owner_id, idempotency_key\)/i);
  });

  it("persists auditable selections and generation-only recovery decisions", async () => {
    const sql = await readFile(new URL("../db/028_artifact_quality_and_recovery.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/create table if not exists xh_artifact_selections/i);
    for (const field of ["source_artifact_ids", "selected_artifact_ids", "rejected_artifact_ids", "evaluation_ids", "evaluator_version"]) expect(sql).toMatch(new RegExp(field, "i"));
    expect(sql).toMatch(/create table if not exists xh_recovery_decisions/i);
    expect(sql).toMatch(/'retry_same_configuration'.*'apply_parameter_repair'.*'switch_generation_model'.*'regenerate_for_quality'.*'request_approval'.*'stop'/is);
    expect(sql).toMatch(/alternative_generation_model_id_snapshot/i);
    expect(sql).not.toMatch(/alternative_llm_model/i);
  });
});
