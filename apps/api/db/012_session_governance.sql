alter table xh_sessions
  add column if not exists last_seen_at timestamptz,
  add column if not exists ip text,
  add column if not exists user_agent text,
  add column if not exists revoked_at timestamptz;

update xh_sessions
set last_seen_at = created_at
where last_seen_at is null;
