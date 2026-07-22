create table if not exists xh_agent_definitions (
  id text primary key,
  agent_key text not null unique,
  name text not null,
  role text not null check (role in ('planner', 'image_understanding', 'video_understanding', 'checker', 'recovery', 'manager')),
  input_schema text not null,
  output_schema text not null,
  tool_allowlist jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_agent_configuration_versions (
  id text primary key,
  agent_definition_id text not null references xh_agent_definitions(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'review', 'approved', 'retired')),
  configuration jsonb not null default '{}'::jsonb,
  created_by text not null references xh_users(id) on delete restrict,
  reviewed_by text references xh_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  unique (agent_definition_id, version)
);

create table if not exists xh_agent_configuration_publications (
  id text primary key,
  configuration_version_id text not null references xh_agent_configuration_versions(id) on delete cascade,
  environment text not null check (environment in ('gray', 'production')),
  published_by text not null references xh_users(id) on delete restrict,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (configuration_version_id, environment)
);

create table if not exists xh_agent_runs (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  canvas_run_id text references xh_canvas_runs(id) on delete cascade,
  parent_agent_run_id text references xh_agent_runs(id) on delete cascade,
  agent_definition_id text not null references xh_agent_definitions(id) on delete restrict,
  configuration_version_id text not null references xh_agent_configuration_versions(id) on delete restrict,
  role text not null check (role in ('planner', 'image_understanding', 'video_understanding', 'checker', 'recovery', 'manager')),
  scenario text not null,
  status text not null check (status in ('queued', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled')),
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  budget_snapshot jsonb not null default '{}'::jsonb,
  error jsonb not null default '{}'::jsonb,
  action_sequence bigint not null default 0,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finalized_at timestamptz,
  unique (owner_id, idempotency_key)
);

create index if not exists idx_xh_agent_runs_owner_updated on xh_agent_runs(owner_id, updated_at desc, id desc);
create index if not exists idx_xh_agent_runs_canvas_run on xh_agent_runs(canvas_run_id, created_at asc);

create table if not exists xh_agent_actions (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  agent_run_id text not null references xh_agent_runs(id) on delete cascade,
  sequence bigint not null,
  action_type text not null,
  tool_name text,
  status text not null check (status in ('proposed', 'approved', 'running', 'succeeded', 'failed', 'rejected')),
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  error jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (agent_run_id, sequence)
);

create table if not exists xh_llm_route_pools (
  id text primary key,
  pool_key text not null unique,
  name text not null,
  role text not null check (role in ('planner', 'image_understanding', 'video_understanding', 'checker', 'recovery', 'manager')),
  scenario text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_llm_route_pool_versions (
  id text primary key,
  pool_id text not null references xh_llm_route_pools(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'review', 'approved', 'retired')),
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_by text not null references xh_users(id) on delete restrict,
  reviewed_by text references xh_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  unique (pool_id, version)
);

create table if not exists xh_llm_route_pool_publications (
  id text primary key,
  pool_version_id text not null references xh_llm_route_pool_versions(id) on delete cascade,
  environment text not null check (environment in ('gray', 'production')),
  published_by text not null references xh_users(id) on delete restrict,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (pool_version_id, environment)
);

create table if not exists xh_llm_route_entries (
  id text primary key,
  pool_version_id text not null references xh_llm_route_pool_versions(id) on delete cascade,
  model_id text not null references xh_models(id) on delete restrict,
  provider_id text not null references xh_providers(id) on delete restrict,
  model_capability_snapshot text not null check (model_capability_snapshot = 'chat'),
  capability_tags_snapshot jsonb not null default '[]'::jsonb,
  priority integer not null check (priority >= 0),
  weight integer not null default 1 check (weight >= 1 and weight <= 1000),
  estimated_cost numeric(18, 6) not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pool_version_id, model_id)
);

create table if not exists xh_llm_route_entry_health (
  route_entry_id text primary key references xh_llm_route_entries(id) on delete cascade,
  state text not null check (state in ('healthy', 'degraded', 'rate_limited', 'unavailable', 'circuit_open', 'half_open', 'draining', 'disabled')),
  consecutive_technical_failures integer not null default 0,
  success_count bigint not null default 0,
  technical_failure_count bigint not null default 0,
  quality_failure_count bigint not null default 0,
  p95_latency_ms integer not null default 0,
  circuit_opened_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists xh_llm_route_decisions (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  agent_run_id text references xh_agent_runs(id) on delete cascade,
  pool_id text not null references xh_llm_route_pools(id) on delete restrict,
  pool_version_id text not null references xh_llm_route_pool_versions(id) on delete restrict,
  role text not null,
  scenario text not null,
  decision_key text not null,
  selected_entry_id text not null references xh_llm_route_entries(id) on delete restrict,
  selected_provider_id text not null,
  selected_model_id text not null,
  candidate_snapshot jsonb not null default '[]'::jsonb,
  rejection_snapshot jsonb not null default '[]'::jsonb,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, decision_key)
);

create index if not exists idx_xh_llm_route_decisions_agent_run on xh_llm_route_decisions(agent_run_id, created_at asc);

create table if not exists xh_agent_tool_policies (
  id text primary key,
  subject_type text not null check (subject_type in ('platform', 'user_group', 'user')),
  subject_id text,
  tool_name text not null,
  effect text not null check (effect in ('allow', 'deny', 'require_approval')),
  constraints jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_by text not null references xh_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_type, subject_id, tool_name)
);
