create table if not exists xh_permission_subjects (
  subject_key text primary key,
  domain text not null,
  subject_type text not null,
  parent_key text,
  source_id text not null,
  exposure_state text not null check (exposure_state in ('restricted', 'published', 'retired')),
  display_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, source_id)
);

create table if not exists xh_permission_rules (
  id text primary key,
  principal_type text not null check (principal_type in ('group', 'user')),
  principal_id text not null,
  subject_key text not null references xh_permission_subjects(subject_key) on delete restrict,
  action text not null check (action in ('view', 'use', 'execute', 'manage', 'export')),
  effect text not null check (effect in ('allow', 'deny')),
  reason text not null default '',
  created_by text references xh_users(id) on delete set null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (principal_type, principal_id, subject_key, action)
);

create index if not exists idx_xh_permission_subjects_domain_exposure
  on xh_permission_subjects(domain, exposure_state);

create index if not exists idx_xh_permission_subjects_parent_key
  on xh_permission_subjects(parent_key);

create index if not exists idx_xh_permission_rules_principal_action
  on xh_permission_rules(principal_type, principal_id, action);
