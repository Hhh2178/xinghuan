create table if not exists xh_generation_artifacts (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio')),
  status text not null default 'active' check (status in ('active', 'promoted', 'expired', 'missing', 'deleted')),
  title text not null,
  storage_key text not null,
  file_url text not null,
  source_url text,
  mime text,
  size_bytes bigint not null default 0,
  source_task_id text references xh_tasks(id) on delete set null,
  source_canvas_id text,
  source_node_id text,
  provider_id text,
  model_id text,
  promoted_asset_id text references xh_assets(id) on delete set null,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz,
  unique (owner_id, dedupe_key)
);

create index if not exists idx_xh_generation_artifacts_owner_visible
  on xh_generation_artifacts(owner_id, status, updated_at desc);

create index if not exists idx_xh_generation_artifacts_expiry
  on xh_generation_artifacts(expires_at asc)
  where status in ('active', 'promoted');

create index if not exists idx_xh_generation_artifacts_task
  on xh_generation_artifacts(owner_id, source_task_id);

create index if not exists idx_xh_generation_artifacts_promoted_asset
  on xh_generation_artifacts(promoted_asset_id)
  where promoted_asset_id is not null;

