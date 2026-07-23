create table if not exists xh_workflow_supervision_settings (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  canvas_id text not null references xh_canvases(id) on delete cascade,
  workflow_id text not null,
  settings jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canvas_id, workflow_id)
);

create index if not exists idx_xh_workflow_supervision_settings_owner
  on xh_workflow_supervision_settings(owner_id, updated_at desc);

comment on table xh_workflow_supervision_settings is
  'Owner-scoped remembered settings for a workflow region. Run creation copies resolved values into immutable snapshots.';
