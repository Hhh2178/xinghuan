alter table xh_assistant_settings
  add column if not exists revision integer not null default 1;

update xh_assistant_settings
set revision = 1
where revision is null or revision < 1;

alter table xh_system_settings
  add column if not exists revision integer not null default 1;

update xh_system_settings
set revision = 1
where revision is null or revision < 1;
