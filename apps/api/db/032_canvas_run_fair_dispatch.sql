create table if not exists xh_canvas_run_dispatch_cursors (
  scope text primary key,
  last_owner_id text not null default '',
  updated_at timestamptz not null default now()
);
