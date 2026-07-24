create table if not exists xh_channel_feedback (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  provider_id text not null references xh_providers(id) on delete cascade,
  model_id text not null references xh_models(id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  eligible_task_id text references xh_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider_id, model_id)
);

create index if not exists idx_xh_tasks_channel_health_settled
  on xh_tasks(created_at desc, provider_id, model_id)
  where status in ('succeeded', 'failed');

create index if not exists idx_xh_tasks_channel_feedback_eligibility
  on xh_tasks(owner_id, provider_id, model_id, created_at desc)
  where status in ('succeeded', 'failed');

create index if not exists idx_xh_channel_feedback_window
  on xh_channel_feedback(provider_id, model_id, updated_at desc);
