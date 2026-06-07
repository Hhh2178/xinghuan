alter table xh_providers add column if not exists protocol text not null default 'openai';
alter table xh_providers add column if not exists last_probe_status text;
alter table xh_providers add column if not exists last_probe_message text;
alter table xh_providers add column if not exists last_fetched_at timestamptz;

alter table xh_models drop constraint if exists xh_models_capability_check;
update xh_models set capability = 'chat' where capability = 'text';
alter table xh_models add constraint xh_models_capability_check check (capability in ('chat', 'image', 'video'));
alter table xh_models add column if not exists protocol_override text;

alter table xh_providers add column if not exists rh_apps jsonb not null default '[]'::jsonb;
alter table xh_providers add column if not exists rh_workflows jsonb not null default '[]'::jsonb;
alter table xh_providers add column if not exists ms_loras jsonb not null default '[]'::jsonb;
