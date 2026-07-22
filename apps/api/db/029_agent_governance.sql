create table if not exists xh_agent_runtime_controls (
  environment text primary key check (environment in ('gray', 'production')),
  agent_enabled boolean not null default false,
  canvas_runs_enabled boolean not null default false,
  automatic_recovery_enabled boolean not null default false,
  quality_evaluation_enabled boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  updated_by text references xh_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists xh_agent_knowledge_collections (
  id text primary key,
  collection_key text not null unique,
  name text not null,
  description text not null default '',
  audience text not null check (audience in ('public', 'internal')),
  enabled boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_by text not null references xh_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists xh_agent_knowledge_documents (
  id text primary key,
  collection_id text not null references xh_agent_knowledge_collections(id) on delete cascade,
  document_key text not null,
  version integer not null check (version > 0),
  title text not null,
  body text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  status text not null check (status in ('draft', 'review', 'approved', 'retired')),
  created_by text not null references xh_users(id) on delete restrict,
  reviewed_by text references xh_users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  retired_at timestamptz,
  unique (collection_id, document_key, version)
);

create table if not exists xh_agent_knowledge_publications (
  id text primary key,
  document_id text not null references xh_agent_knowledge_documents(id) on delete cascade,
  environment text not null check (environment in ('gray', 'production')),
  published_by text not null references xh_users(id) on delete restrict,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (document_id, environment)
);

create index if not exists idx_xh_agent_knowledge_documents_collection
  on xh_agent_knowledge_documents(collection_id, document_key, version desc);
create index if not exists idx_xh_agent_knowledge_publications_active
  on xh_agent_knowledge_publications(environment, document_id) where retired_at is null;
