create table if not exists xh_task_runtime_events (
  id text primary key,
  task_id text not null references xh_tasks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_xh_task_runtime_events_task_created_at
  on xh_task_runtime_events(task_id, created_at desc);

create index if not exists idx_xh_task_runtime_events_type_created_at
  on xh_task_runtime_events(event_type, created_at desc);
