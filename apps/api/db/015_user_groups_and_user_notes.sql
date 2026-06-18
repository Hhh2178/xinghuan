create table if not exists xh_user_groups (
  id text primary key,
  name text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table xh_users
  add column if not exists group_id text references xh_user_groups(id) on delete set null;

alter table xh_users
  add column if not exists remark text not null default '';

create index if not exists idx_xh_users_group_id on xh_users(group_id);
create index if not exists idx_xh_user_groups_sort_order_created_at on xh_user_groups(sort_order asc, created_at asc);
