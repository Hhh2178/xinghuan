alter table xh_tasks
  add column if not exists execution_identity_snapshot jsonb not null default '{}'::jsonb;

update xh_tasks t
set execution_identity_snapshot = jsonb_strip_nulls(jsonb_build_object(
  'providerId', coalesce(t.provider_id, ''),
  'providerName', coalesce(
    (select p.name from xh_providers p where p.id = t.provider_id limit 1),
    t.provider_id,
    ''
  ),
  'modelRecordId', coalesce(t.model_id, ''),
  'providerModelId', coalesce(
    (select m.model_id from xh_models m
      where m.id = t.model_id or (m.provider_id = t.provider_id and m.model_id = t.model_id)
      order by case when m.id = t.model_id then 0 else 1 end
      limit 1),
    t.model_id,
    ''
  ),
  'modelName', coalesce(
    (select coalesce(nullif(m.display_name, ''), nullif(m.model_id, '')) from xh_models m
      where m.id = t.model_id or (m.provider_id = t.provider_id and m.model_id = t.model_id)
      order by case when m.id = t.model_id then 0 else 1 end
      limit 1),
    t.model_id,
    ''
  )
))
where t.execution_identity_snapshot = '{}'::jsonb;

create or replace function xh_freeze_task_execution_identity_snapshot()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.execution_identity_snapshot, '{}'::jsonb) = '{}'::jsonb then
    new.execution_identity_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'providerId', coalesce(new.provider_id, ''),
      'providerName', coalesce(
        (select p.name from xh_providers p where p.id = new.provider_id limit 1),
        new.provider_id,
        ''
      ),
      'modelRecordId', coalesce(new.model_id, ''),
      'providerModelId', coalesce(
        (select m.model_id from xh_models m
          where m.id = new.model_id or (m.provider_id = new.provider_id and m.model_id = new.model_id)
          order by case when m.id = new.model_id then 0 else 1 end
          limit 1),
        new.model_id,
        ''
      ),
      'modelName', coalesce(
        (select coalesce(nullif(m.display_name, ''), nullif(m.model_id, '')) from xh_models m
          where m.id = new.model_id or (m.provider_id = new.provider_id and m.model_id = new.model_id)
          order by case when m.id = new.model_id then 0 else 1 end
          limit 1),
        new.model_id,
        ''
      )
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists xh_tasks_freeze_execution_identity on xh_tasks;
create trigger xh_tasks_freeze_execution_identity
before insert on xh_tasks
for each row execute function xh_freeze_task_execution_identity_snapshot();

comment on column xh_tasks.execution_identity_snapshot is
  'Immutable Provider/model display identity captured when the task is created.';
