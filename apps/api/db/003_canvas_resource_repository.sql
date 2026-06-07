create table if not exists xh_resource_categories (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio', 'set', 'pose', 'workflow')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table xh_assets add column if not exists category_id text references xh_resource_categories(id) on delete set null;
alter table xh_assets add column if not exists tags jsonb not null default '[]'::jsonb;
alter table xh_assets add column if not exists favorite boolean not null default false;
alter table xh_assets add column if not exists last_used_at timestamptz;

create index if not exists idx_xh_canvases_owner_updated_at on xh_canvases(owner_id, updated_at desc);
create index if not exists idx_xh_resource_categories_owner_id on xh_resource_categories(owner_id);
create index if not exists idx_xh_assets_owner_category_id on xh_assets(owner_id, category_id);
