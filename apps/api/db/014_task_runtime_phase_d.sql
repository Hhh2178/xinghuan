create index if not exists idx_xh_tasks_status_updated_at on xh_tasks(status, updated_at desc);
create index if not exists idx_xh_tasks_created_at_desc on xh_tasks(created_at desc);
create index if not exists idx_xh_tasks_provider_created_at on xh_tasks(provider_id, created_at desc);
