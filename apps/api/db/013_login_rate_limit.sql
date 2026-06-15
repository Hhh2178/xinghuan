create table if not exists xh_login_attempts (
  key text primary key,
  scope text not null check (scope in ('member', 'admin')),
  email text not null,
  ip text not null,
  failure_count integer not null default 0,
  first_failed_at timestamptz not null,
  last_failed_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_xh_login_attempts_updated_at on xh_login_attempts(updated_at desc);
create index if not exists idx_xh_login_attempts_email_ip on xh_login_attempts(email, ip, scope);
