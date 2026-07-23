alter table xh_canvas_runs
  add column if not exists workflow_id text,
  add column if not exists workflow_revision bigint,
  add column if not exists workflow_subgraph_hash text;

alter table xh_canvas_runs
  drop constraint if exists xh_canvas_runs_run_scope_check;

alter table xh_canvas_runs
  add constraint xh_canvas_runs_run_scope_check
  check (run_scope in ('canvas', 'group', 'downstream', 'workflow'));

alter table xh_canvas_runs
  drop constraint if exists xh_canvas_runs_workflow_identity_check;

alter table xh_canvas_runs
  add constraint xh_canvas_runs_workflow_identity_check
  check (
    (run_scope = 'workflow' and workflow_id is not null and workflow_revision is not null and workflow_subgraph_hash is not null)
    or
    (run_scope <> 'workflow' and workflow_id is null and workflow_revision is null and workflow_subgraph_hash is null)
  );

create unique index if not exists uq_xh_canvas_runs_active_workflow
  on xh_canvas_runs(owner_id, canvas_id, workflow_id)
  where workflow_id is not null
    and status in ('planning', 'awaiting_approval', 'queued', 'running', 'paused');

create index if not exists idx_xh_canvas_runs_workflow_updated
  on xh_canvas_runs(owner_id, canvas_id, workflow_id, updated_at desc, id desc)
  where workflow_id is not null;

comment on column xh_canvas_runs.workflow_subgraph_hash is
  'SHA-256 of execution-relevant workflow topology/configuration; excludes region geometry and color.';
