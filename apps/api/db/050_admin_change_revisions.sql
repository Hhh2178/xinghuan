create table if not exists xh_admin_change_revisions (
  domain text primary key,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into xh_admin_change_revisions(domain)
values ('shell'), ('providers'), ('models'), ('directory'), ('permissions'), ('runninghub'), ('comfyui'), ('shared-resources'), ('tasks'), ('content'), ('analytics'), ('system')
on conflict (domain) do nothing;
