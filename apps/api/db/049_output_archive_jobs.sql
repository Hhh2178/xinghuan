create table if not exists xh_output_archive_jobs (
  id text primary key,
  owner_id text not null,
  source_task_id text not null,
  source_fingerprint text not null,
  status text not null check (status in ('queued', 'running', 'ready', 'downloaded', 'failed', 'cancelled', 'expired')),
  file_count integer not null default 0,
  source_bytes bigint not null default 0,
  archive_bytes bigint,
  archive_relative_path text,
  archive_filename text,
  manifest jsonb not null default '{}'::jsonb,
  error_code text,
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  cancel_requested_at timestamptz,
  download_count integer not null default 0,
  downloaded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_xh_output_archive_jobs_queue
  on xh_output_archive_jobs(status, created_at, id);

create index if not exists idx_xh_output_archive_jobs_owner
  on xh_output_archive_jobs(owner_id, status, created_at, id);

create unique index if not exists idx_xh_output_archive_jobs_active_fingerprint
  on xh_output_archive_jobs(owner_id, source_task_id, source_fingerprint)
  where status in ('queued', 'running', 'ready', 'downloaded');

create table if not exists xh_output_archive_dispatch_slots (
  scope text primary key,
  lease_owner text not null default '',
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into xh_output_archive_dispatch_slots(scope)
values ('global')
on conflict (scope) do nothing;

create table if not exists xh_output_archive_dispatch_cursors (
  scope text primary key,
  last_owner_id text not null default '',
  updated_at timestamptz not null default now()
);

insert into xh_output_archive_dispatch_cursors(scope)
values ('global')
on conflict (scope) do nothing;
