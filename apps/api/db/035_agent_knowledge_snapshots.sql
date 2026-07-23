create table if not exists xh_agent_knowledge_snapshots (
  id text primary key,
  owner_id text not null references xh_users(id) on delete restrict,
  environment text not null check (environment in ('gray', 'production')),
  audience text not null check (audience in ('public', 'internal')),
  node_catalog_version text not null,
  node_catalog_hash text not null,
  node_catalog_projection jsonb not null,
  model_catalog_revision text not null,
  model_catalog_hash text not null,
  model_catalog_projection jsonb not null,
  document_publications jsonb not null default '[]'::jsonb,
  workflow_template_refs jsonb not null default '[]'::jsonb,
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, snapshot_hash)
);

create index if not exists idx_xh_agent_knowledge_snapshots_owner_created
  on xh_agent_knowledge_snapshots(owner_id, created_at desc, id desc);

create or replace function xh_reject_agent_knowledge_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'AGENT_KNOWLEDGE_SNAPSHOT_IMMUTABLE';
end;
$$;

drop trigger if exists trg_xh_agent_knowledge_snapshots_immutable on xh_agent_knowledge_snapshots;
create trigger trg_xh_agent_knowledge_snapshots_immutable
before update or delete on xh_agent_knowledge_snapshots
for each row execute function xh_reject_agent_knowledge_snapshot_mutation();

alter table xh_agent_runs
  add column if not exists knowledge_snapshot_id text references xh_agent_knowledge_snapshots(id) on delete restrict;

create index if not exists idx_xh_agent_runs_knowledge_snapshot
  on xh_agent_runs(knowledge_snapshot_id);
