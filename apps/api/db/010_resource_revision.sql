alter table xh_resource_categories
  add column if not exists revision integer not null default 1;

update xh_resource_categories
set revision = 1
where revision is null or revision < 1;

alter table xh_assets
  add column if not exists revision integer not null default 1;

update xh_assets
set revision = 1
where revision is null or revision < 1;
