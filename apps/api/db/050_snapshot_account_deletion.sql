-- The owner deletion cascades to its snapshots and agent runs in one transaction.
-- Deferring the run reference makes their cascade order irrelevant and still
-- rejects deletion when another remaining run refers to the snapshot.
alter table xh_agent_knowledge_snapshots
  drop constraint xh_agent_knowledge_snapshots_owner_id_fkey;
alter table xh_agent_knowledge_snapshots
  add constraint xh_agent_knowledge_snapshots_owner_id_fkey
  foreign key (owner_id) references xh_users(id) on delete cascade;

alter table xh_agent_runs
  drop constraint xh_agent_runs_knowledge_snapshot_id_fkey;
alter table xh_agent_runs
  add constraint xh_agent_runs_knowledge_snapshot_id_fkey
  foreign key (knowledge_snapshot_id) references xh_agent_knowledge_snapshots(id)
  on delete no action deferrable initially deferred;

create or replace function xh_reject_agent_knowledge_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' and not exists (select 1 from xh_users where id = OLD.owner_id) then
    return OLD;
  end if;
  raise exception 'AGENT_KNOWLEDGE_SNAPSHOT_IMMUTABLE';
end;
$$;
