alter table xh_canvases
  add column if not exists revision integer not null default 1;

update xh_canvases
set revision = 1
where revision is null or revision < 1;
