create table if not exists xh_group_permission_policies (
  group_id text primary key references xh_user_groups(id) on delete cascade,
  deny jsonb not null default '{}'::jsonb,
  updated_by text references xh_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_xh_group_permission_policies_updated_at
  on xh_group_permission_policies(updated_at desc);
