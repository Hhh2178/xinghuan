alter table xh_canvas_run_steps
  add column if not exists execution_layer integer;

update xh_canvas_run_steps s
set execution_layer = case
  when s.status = 'skipped' then null
  else coalesce((
    select nullif(step->>'executionLayer', '')::integer
    from xh_canvas_runs r,
         jsonb_array_elements(coalesce(r.plan_snapshot->'steps', '[]'::jsonb)) step
    where r.id = s.run_id
      and step->>'id' = s.step_key
    limit 1
  ), 0)
end
where s.execution_layer is null;

create index if not exists idx_xh_canvas_run_steps_layer_status
  on xh_canvas_run_steps(run_id, execution_layer, status, sequence);
