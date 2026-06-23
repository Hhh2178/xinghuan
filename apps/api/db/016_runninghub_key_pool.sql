alter table xh_providers
  add column if not exists rh_key_pool jsonb not null default '[]'::jsonb;
