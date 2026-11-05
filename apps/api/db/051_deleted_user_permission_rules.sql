-- Permission rules owned by deleted accounts cannot be used and block readiness.
delete from xh_permission_rules r
where r.principal_type = 'user'
  and not exists (
    select 1 from xh_users u where u.id = r.principal_id
  );
