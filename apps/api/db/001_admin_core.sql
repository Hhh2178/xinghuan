create table if not exists xh_users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'member')),
  password_hash text not null,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_sessions (
  id text primary key,
  user_id text not null references xh_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists xh_projects (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_canvases (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  project_id text references xh_projects(id) on delete set null,
  name text not null,
  node_count integer not null default 0,
  data jsonb not null default '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1},"nextNodeSerialId":1}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_assets (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  project_id text references xh_projects(id) on delete set null,
  kind text not null,
  title text not null,
  url text,
  mime text,
  size_bytes bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_providers (
  id text primary key,
  name text not null,
  base_url text,
  enabled boolean not null default false,
  api_key_cipher text,
  api_key_preview text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_models (
  id text primary key,
  provider_id text not null references xh_providers(id) on delete cascade,
  model_id text not null,
  display_name text not null,
  capability text not null check (capability in ('text', 'image', 'video', 'audio')),
  enabled boolean not null default false,
  input_profile text not null default 'prompt',
  parameter_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_tasks (
  id text primary key,
  owner_id text references xh_users(id) on delete set null,
  title text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  provider_id text references xh_providers(id) on delete set null,
  model_id text references xh_models(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_audit_logs (
  id text primary key,
  actor_id text references xh_users(id) on delete set null,
  actor_email text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  summary text not null,
  ip text,
  user_agent text,
  request_id text,
  created_at timestamptz not null default now()
);

create table if not exists xh_schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

create index if not exists idx_xh_sessions_user_id on xh_sessions(user_id);
create index if not exists idx_xh_canvases_owner_id on xh_canvases(owner_id);
create index if not exists idx_xh_assets_owner_id on xh_assets(owner_id);
create index if not exists idx_xh_tasks_status on xh_tasks(status);
create index if not exists idx_xh_audit_logs_created_at on xh_audit_logs(created_at desc);
