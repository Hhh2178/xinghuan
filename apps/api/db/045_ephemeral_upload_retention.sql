create table if not exists xh_ephemeral_uploads (
  id text primary key,
  owner_id text not null references xh_users(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio')),
  storage_key text not null,
  file_url text not null,
  mime text,
  size_bytes bigint not null default 0,
  status text not null default 'active' check (status in ('active', 'expired', 'missing', 'deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz,
  last_error text,
  unique (owner_id, storage_key)
);

create index if not exists idx_xh_ephemeral_uploads_expiry
  on xh_ephemeral_uploads(expires_at asc)
  where status in ('active', 'expired');

create index if not exists idx_xh_ephemeral_uploads_owner_status
  on xh_ephemeral_uploads(owner_id, status, updated_at desc);
