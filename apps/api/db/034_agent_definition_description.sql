alter table xh_agent_definitions
  add column if not exists description text not null default '';
