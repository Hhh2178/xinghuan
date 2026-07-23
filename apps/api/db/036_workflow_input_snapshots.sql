alter table xh_canvas_runs
  add column if not exists input_snapshot jsonb not null default '{}'::jsonb;

comment on column xh_canvas_runs.input_snapshot is
  'Immutable workflow variable values frozen when a run is created; empty for legacy canvas-scoped runs.';
