create table if not exists xh_assistant_settings (
  id text primary key,
  frontend jsonb not null default '{}'::jsonb,
  backend jsonb not null default '{}'::jsonb,
  integration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
