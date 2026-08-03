alter table xh_providers
add column if not exists rh_groups jsonb not null default '[]'::jsonb;
