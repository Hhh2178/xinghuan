-- `ungrouped` is a virtual permission bucket, not a row in xh_user_groups.
-- Keeping a foreign key here prevents the admin policy route from persisting it.
alter table xh_group_permission_policies
  drop constraint if exists xh_group_permission_policies_group_id_fkey;
