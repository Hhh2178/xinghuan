alter table xh_llm_route_entries
  add column if not exists model_input_capabilities_snapshot jsonb not null default '{}'::jsonb;

alter table xh_llm_route_entries
  add column if not exists media_input_transports_snapshot jsonb not null default '[]'::jsonb;
