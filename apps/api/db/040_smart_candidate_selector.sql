alter table xh_canvas_run_steps
  add column if not exists candidate_context jsonb not null default '{}'::jsonb;

create table if not exists xh_canvas_run_candidate_artifacts (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  canvas_run_id text not null references xh_canvas_runs(id) on delete cascade,
  run_step_id text not null references xh_canvas_run_steps(id) on delete cascade,
  source_run_step_id text references xh_canvas_run_steps(id) on delete set null,
  artifact_id text not null references xh_generation_artifacts(id) on delete cascade,
  media_kind text not null check (media_kind in ('image', 'video')),
  selection_status text not null check (selection_status in ('candidate', 'selected', 'not_selected')),
  provenance_snapshot jsonb not null default '{}'::jsonb,
  score_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_step_id, artifact_id)
);

create index if not exists idx_xh_canvas_run_candidate_artifacts_run_step
  on xh_canvas_run_candidate_artifacts(canvas_run_id, run_step_id, selection_status, created_at);

alter table xh_artifact_selections
  add column if not exists selection_mode text
  check (selection_mode is null or selection_mode in ('manual', 'ai'));

alter table xh_artifact_selections
  add column if not exists criteria_snapshot jsonb not null default '{}'::jsonb;

alter table xh_artifact_selections
  add column if not exists note_snapshot text not null default '';

alter table xh_artifact_selections
  add column if not exists candidate_snapshot jsonb not null default '[]'::jsonb;

alter table xh_artifact_selections
  add column if not exists score_snapshot jsonb not null default '[]'::jsonb;

alter table xh_artifact_selections
  add column if not exists overridden_by_user_id text references xh_users(id) on delete set null;

alter table xh_artifact_selections
  add column if not exists selected_at timestamptz;

alter table xh_artifact_selections
  add column if not exists idempotency_key text;

create unique index if not exists idx_xh_artifact_selections_owner_idempotency
  on xh_artifact_selections(owner_id, idempotency_key)
  where idempotency_key is not null;
