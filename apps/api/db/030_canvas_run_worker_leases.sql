alter table xh_canvas_run_steps add column if not exists lease_owner text;
alter table xh_canvas_run_steps add column if not exists lease_expires_at timestamptz;
alter table xh_canvas_run_steps add column if not exists dispatch_enqueued_at timestamptz;
alter table xh_canvas_run_steps add column if not exists quality_task_id text references xh_tasks(id) on delete set null;
alter table xh_canvas_run_steps add column if not exists quality_dispatch_enqueued_at timestamptz;
alter table xh_canvas_run_steps add column if not exists quality_context jsonb not null default '{}'::jsonb;

create index if not exists idx_xh_canvas_run_steps_worker_claim
  on xh_canvas_run_steps(status, lease_expires_at, sequence)
  where status in ('ready', 'queued', 'running', 'retry_wait');

create index if not exists idx_xh_canvas_run_steps_quality_claim
  on xh_canvas_run_steps(status, quality_dispatch_enqueued_at, updated_at)
  where status in ('evaluating', 'selecting');
