create table if not exists xh_announcements (
  id text primary key,
  title text not null,
  summary text not null default '',
  content text not null default '',
  type text not null,
  priority text not null,
  status text not null,
  scope text not null,
  pinned boolean not null default false,
  strong_reminder boolean not null default false,
  popup_enabled boolean not null default true,
  version_tag text,
  published_at timestamptz,
  expire_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_xh_announcements_type
    check (type in ('manual', 'release-note', 'system')),
  constraint chk_xh_announcements_priority
    check (priority in ('normal', 'important', 'strong-reminder')),
  constraint chk_xh_announcements_status
    check (status in ('draft', 'published', 'archived')),
  constraint chk_xh_announcements_scope
    check (scope in ('all-users', 'admins-only'))
);

create index if not exists idx_xh_announcements_status_published_at
  on xh_announcements(status, published_at desc nulls last, created_at desc);

create index if not exists idx_xh_announcements_scope_status
  on xh_announcements(scope, status, created_at desc);

create index if not exists idx_xh_announcements_pinned_priority
  on xh_announcements(pinned desc, priority, created_at desc);

create table if not exists xh_announcement_reads (
  announcement_id text not null references xh_announcements(id) on delete cascade,
  user_id text not null,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_xh_announcement_reads_user_read_at
  on xh_announcement_reads(user_id, read_at desc);

create index if not exists idx_xh_announcement_reads_announcement_read_at
  on xh_announcement_reads(announcement_id, read_at desc);
