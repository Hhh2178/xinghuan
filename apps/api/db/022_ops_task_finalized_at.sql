alter table xh_tasks add column if not exists finalized_at timestamptz;

create index if not exists idx_xh_tasks_updated_created_id_desc
  on xh_tasks(updated_at desc, created_at desc, id desc);
