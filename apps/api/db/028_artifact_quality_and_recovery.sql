create table if not exists xh_artifact_quality_profiles (
  id text primary key,
  profile_key text not null,
  version integer not null,
  media_kind text not null check (media_kind in ('image', 'video')),
  status text not null check (status in ('draft', 'review', 'approved', 'retired')),
  minimum_overall_score numeric(6, 2) not null check (minimum_overall_score between 0 and 100),
  minimum_confidence numeric(5, 4) not null check (minimum_confidence between 0 and 1),
  weights jsonb not null default '{}'::jsonb,
  instructions text not null default '',
  created_by text not null references xh_users(id) on delete restrict,
  reviewed_by text references xh_users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  retired_at timestamptz,
  unique (profile_key, version)
);

create table if not exists xh_artifact_quality_profile_publications (
  id text primary key,
  quality_profile_id text not null references xh_artifact_quality_profiles(id) on delete cascade,
  environment text not null check (environment in ('gray', 'production')),
  published_by text not null references xh_users(id) on delete restrict,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (quality_profile_id, environment)
);

create table if not exists xh_artifact_evaluations (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  artifact_id text not null references xh_generation_artifacts(id) on delete cascade,
  canvas_run_id text references xh_canvas_runs(id) on delete cascade,
  run_step_id text references xh_canvas_run_steps(id) on delete cascade,
  agent_run_id text references xh_agent_runs(id) on delete set null,
  quality_profile_id text not null references xh_artifact_quality_profiles(id) on delete restrict,
  media_kind text not null check (media_kind in ('image', 'video')),
  evaluator_entry_id text references xh_llm_route_entries(id) on delete set null,
  evaluator_provider_id_snapshot text,
  evaluator_model_id_snapshot text,
  score_snapshot jsonb not null default '{}'::jsonb,
  evidence_snapshot jsonb not null default '[]'::jsonb,
  defect_snapshot jsonb not null default '[]'::jsonb,
  sample_snapshot jsonb not null default '{}'::jsonb,
  overall_score numeric(6, 2) not null check (overall_score between 0 and 100),
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  passed boolean not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create index if not exists idx_xh_artifact_evaluations_artifact_created on xh_artifact_evaluations(artifact_id, created_at desc);

create table if not exists xh_artifact_selections (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  canvas_run_id text not null references xh_canvas_runs(id) on delete cascade,
  run_step_id text not null references xh_canvas_run_steps(id) on delete cascade,
  binding_key text not null,
  policy text not null check (policy in ('single', 'many', 'first', 'last', 'best', 'top_k', 'threshold', 'diverse', 'merge', 'loop', 'reject')),
  source_artifact_ids jsonb not null default '[]'::jsonb,
  selected_artifact_ids jsonb not null default '[]'::jsonb,
  rejected_artifact_ids jsonb not null default '[]'::jsonb,
  evaluation_ids jsonb not null default '[]'::jsonb,
  reason text not null,
  confidence numeric(5, 4),
  evaluator_version text not null,
  binding_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_step_id, binding_key)
);

create table if not exists xh_recovery_decisions (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  canvas_run_id text not null references xh_canvas_runs(id) on delete cascade,
  run_step_id text not null references xh_canvas_run_steps(id) on delete cascade,
  task_attempt_id text references xh_task_attempts(id) on delete set null,
  agent_run_id text references xh_agent_runs(id) on delete set null,
  failure_category text not null check (failure_category in ('transient', 'provider', 'capability', 'input', 'parameter', 'policy', 'content', 'quality', 'unknown')),
  action_type text not null check (action_type in ('retry_same_configuration', 'apply_parameter_repair', 'switch_generation_model', 'regenerate_for_quality', 'request_approval', 'stop')),
  current_generation_provider_id_snapshot text,
  current_generation_model_id_snapshot text,
  alternative_generation_provider_id_snapshot text,
  alternative_generation_model_id_snapshot text,
  parameter_patch jsonb not null default '{}'::jsonb,
  budget_snapshot jsonb not null default '{}'::jsonb,
  reason text not null,
  approval_id text references xh_agent_approvals(id) on delete set null,
  status text not null check (status in ('proposed', 'approved', 'applied', 'rejected', 'failed', 'stopped')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (owner_id, idempotency_key)
);

create index if not exists idx_xh_recovery_decisions_step_created on xh_recovery_decisions(run_step_id, created_at asc);
