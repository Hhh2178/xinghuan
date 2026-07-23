alter table xh_canvas_run_steps
  add column if not exists retry_not_before timestamptz;

alter table xh_canvas_run_steps
  add column if not exists recovery_overrides jsonb not null default '{}'::jsonb;

alter table xh_canvas_run_steps
  add column if not exists recovery_context jsonb not null default '{}'::jsonb;

create index if not exists idx_xh_canvas_run_steps_retry_due
  on xh_canvas_run_steps(retry_not_before, updated_at)
  where status = 'retry_wait';

alter table xh_recovery_decisions
  add column if not exists input_before_snapshot jsonb not null default '{}'::jsonb;

alter table xh_recovery_decisions
  add column if not exists input_after_snapshot jsonb not null default '{}'::jsonb;

alter table xh_recovery_decisions
  add column if not exists diff_snapshot jsonb not null default '[]'::jsonb;

alter table xh_recovery_decisions
  add column if not exists recovery_attempt_no integer;

alter table xh_recovery_decisions
  drop constraint if exists xh_recovery_decisions_action_type_check;

alter table xh_recovery_decisions
  add constraint xh_recovery_decisions_action_type_check check (action_type in (
    'retry_same_configuration',
    'apply_parameter_repair',
    'switch_generation_model',
    'regenerate_for_quality',
    'rewrite_prompt_for_review',
    'request_approval',
    'stop'
  ));
