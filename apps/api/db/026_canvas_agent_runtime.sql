create table if not exists xh_canvas_runs (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  canvas_id text not null references xh_canvases(id) on delete cascade,
  canvas_revision bigint not null,
  run_scope text not null default 'canvas' check (run_scope in ('canvas', 'group', 'downstream')),
  status text not null check (status in (
    'draft', 'planning', 'awaiting_approval', 'queued', 'running', 'paused', 'succeeded', 'failed', 'cancelled'
  )),
  plan_snapshot jsonb not null default '{}'::jsonb,
  configuration_snapshot jsonb not null default '{}'::jsonb,
  budget_snapshot jsonb not null default '{}'::jsonb,
  event_sequence bigint not null default 0,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finalized_at timestamptz,
  unique (owner_id, idempotency_key)
);

create index if not exists idx_xh_canvas_runs_owner_updated
  on xh_canvas_runs(owner_id, updated_at desc, id desc);

create index if not exists idx_xh_canvas_runs_canvas_updated
  on xh_canvas_runs(canvas_id, updated_at desc, id desc);

create index if not exists idx_xh_canvas_runs_active
  on xh_canvas_runs(status, updated_at)
  where status in ('planning', 'awaiting_approval', 'queued', 'running', 'paused');

create table if not exists xh_canvas_run_steps (
  id text primary key,
  run_id text not null references xh_canvas_runs(id) on delete cascade,
  step_key text not null,
  node_id text not null,
  node_type text not null,
  group_id text,
  sequence integer not null,
  iteration integer not null default 0,
  status text not null check (status in (
    'blocked', 'ready', 'queued', 'running', 'evaluating', 'selecting', 'awaiting_approval',
    'retry_wait', 'paused', 'succeeded', 'failed', 'cancelled', 'skipped'
  )),
  depends_on jsonb not null default '[]'::jsonb,
  input_binding jsonb not null default '{}'::jsonb,
  output_binding jsonb not null default '{}'::jsonb,
  task_id text references xh_tasks(id) on delete set null,
  attempt_count integer not null default 0,
  error jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finalized_at timestamptz,
  unique (run_id, step_key)
);

create index if not exists idx_xh_canvas_run_steps_run_sequence
  on xh_canvas_run_steps(run_id, sequence, iteration);

create index if not exists idx_xh_canvas_run_steps_active
  on xh_canvas_run_steps(status, updated_at)
  where status in ('ready', 'queued', 'running', 'evaluating', 'selecting', 'retry_wait');

create table if not exists xh_canvas_run_events (
  id text primary key,
  run_id text not null references xh_canvas_runs(id) on delete cascade,
  run_step_id text references xh_canvas_run_steps(id) on delete cascade,
  sequence bigint not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create index if not exists idx_xh_canvas_run_events_run_sequence
  on xh_canvas_run_events(run_id, sequence);

create table if not exists xh_task_attempts (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  run_step_id text not null references xh_canvas_run_steps(id) on delete cascade,
  task_id text references xh_tasks(id) on delete set null,
  attempt_no integer not null,
  provider_id text references xh_providers(id) on delete set null,
  model_id text references xh_models(id) on delete set null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  reason text,
  error_class text,
  parameter_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (run_step_id, attempt_no),
  unique (owner_id, idempotency_key)
);

create index if not exists idx_xh_task_attempts_step_created
  on xh_task_attempts(run_step_id, created_at desc);

create table if not exists xh_canvas_run_commands (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  run_id text not null references xh_canvas_runs(id) on delete cascade,
  command_type text not null check (command_type in ('start', 'pause', 'resume', 'cancel', 'retry')),
  idempotency_key text not null,
  request_snapshot jsonb not null default '{}'::jsonb,
  response_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create index if not exists idx_xh_canvas_run_commands_run_created
  on xh_canvas_run_commands(run_id, created_at desc);

create table if not exists xh_agent_approvals (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  canvas_run_id text references xh_canvas_runs(id) on delete cascade,
  run_step_id text references xh_canvas_run_steps(id) on delete cascade,
  action_type text not null,
  action_snapshot jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by text not null,
  decided_by text references xh_users(id) on delete set null,
  decision_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_xh_agent_approvals_owner_status
  on xh_agent_approvals(owner_id, status, created_at desc);
