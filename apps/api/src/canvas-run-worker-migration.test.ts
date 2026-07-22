import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('canvas run worker migration', () => {
  it('adds expiring step leases and durable dispatch acknowledgement', () => {
    const sql = readFileSync(new URL('../db/030_canvas_run_worker_leases.sql', import.meta.url), 'utf8');
    expect(sql).toMatch(/lease_owner text/);
    expect(sql).toMatch(/lease_expires_at timestamptz/);
    expect(sql).toMatch(/dispatch_enqueued_at timestamptz/);
    expect(sql).toMatch(/quality_task_id text references xh_tasks/);
    expect(sql).toMatch(/quality_dispatch_enqueued_at timestamptz/);
    expect(sql).toMatch(/quality_context jsonb/);
    expect(sql).toMatch(/idx_xh_canvas_run_steps_worker_claim/);
    expect(sql).toMatch(/idx_xh_canvas_run_steps_quality_claim/);
  });

  it('keeps quality tasks inside cancel and retry lifecycle management', () => {
    const repository = readFileSync(new URL('./canvas-run-repository.ts', import.meta.url), 'utf8');
    expect(repository).toMatch(/select quality_task_id from xh_canvas_run_steps/);
    expect(repository).toMatch(/quality_dispatch_enqueued_at = null, quality_context = '\{\}'::jsonb/);
    expect(repository).toMatch(/update xh_agent_runs set status = 'cancelled'/);
  });
});
