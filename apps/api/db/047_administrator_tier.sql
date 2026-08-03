alter table xh_users add column if not exists administrator_tier text;

update xh_users
set administrator_tier = 'root'
where role = 'admin' and administrator_tier is null;

update xh_users
set administrator_tier = null
where role = 'member' and administrator_tier is not null;

alter table xh_users drop constraint if exists xh_users_administrator_tier_check;
alter table xh_users add constraint xh_users_administrator_tier_check check (
  (role = 'member' and administrator_tier is null)
  or (role = 'admin' and administrator_tier in ('root', 'operator'))
);
