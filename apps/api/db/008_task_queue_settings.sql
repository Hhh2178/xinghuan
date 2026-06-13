create table if not exists xh_system_settings (
  id text primary key,
  task_queue_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
