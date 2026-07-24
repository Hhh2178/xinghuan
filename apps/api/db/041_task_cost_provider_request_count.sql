create or replace function xh_capture_and_finalize_task_cost()
returns trigger
language plpgsql
as $$
declare
  pricing xh_model_pricing_versions%rowtype;
  requested numeric;
  output_duration numeric;
  upstream_billed numeric;
  provider_request_count numeric;
  resolved_quantity integer;
  resolved_source text;
  upstream_cancel_confirmed boolean;
begin
  if tg_op = 'INSERT' then
    select pv.* into pricing
      from xh_model_pricing_versions pv
     where pv.model_id = new.model_id
       and pv.enabled = true
       and pv.effective_from <= new.created_at
       and (pv.effective_to is null or pv.effective_to > new.created_at)
     order by pv.effective_from desc
     limit 1;

    requested := coalesce(
      xh_cost_safe_numeric(new.payload->>'durationSeconds'),
      xh_cost_safe_numeric(new.payload->>'duration'),
      xh_cost_safe_numeric(new.payload#>>'{params,durationSeconds}'),
      xh_cost_safe_numeric(new.payload#>>'{params,duration}')
    );

    insert into xh_task_cost_items (
      id, task_id, pricing_version_id,
      owner_id_snapshot, owner_email_snapshot, owner_name_snapshot,
      group_id_snapshot, group_name_snapshot,
      provider_id_snapshot, provider_name_snapshot,
      model_id_snapshot, model_native_id_snapshot, model_name_snapshot,
      billing_unit, unit_price, currency, status, requested_seconds, created_at
    )
    select
      'cost_' || md5(new.id || ':provider_cost'), new.id, pricing.id,
      new.owner_id, coalesce(u.email, ''), coalesce(u.name, ''),
      u.group_id, coalesce(g.name, '未分组'),
      coalesce(m.provider_id, new.provider_id), coalesce(p.name, ''),
      new.model_id, coalesce(m.model_id, ''), coalesce(m.display_name, ''),
      pricing.billing_unit, pricing.unit_price, coalesce(pricing.currency, 'CNY'),
      case when pricing.id is null then 'unpriced' else 'pending' end,
      requested, new.created_at
    from (select 1) seed
    left join xh_users u on u.id = new.owner_id
    left join xh_user_groups g on g.id = u.group_id
    left join xh_models m on m.id = new.model_id
    left join xh_providers p on p.id = coalesce(m.provider_id, new.provider_id)
    on conflict (task_id, cost_item_type) do nothing;
  end if;

  if new.status not in ('succeeded', 'failed', 'cancelled') then return new; end if;

  upstream_billed := coalesce(
    xh_cost_safe_numeric(new.result->>'billedSeconds'),
    xh_cost_safe_numeric(new.result->>'billingSeconds'),
    xh_cost_safe_numeric(new.result#>>'{raw,billedSeconds}'),
    xh_cost_safe_numeric(new.result#>>'{raw,billingSeconds}')
  );
  output_duration := coalesce(
    xh_cost_safe_numeric(new.result->>'outputDurationSeconds'),
    xh_cost_safe_numeric(new.result->>'durationSeconds'),
    xh_cost_safe_numeric(new.result#>>'{raw,outputDurationSeconds}'),
    xh_cost_safe_numeric(new.result#>>'{raw,durationSeconds}')
  );
  provider_request_count := xh_cost_safe_numeric(new.result->>'providerRequestCount');
  upstream_cancel_confirmed := lower(coalesce(new.result->>'upstreamCancelled', 'false')) = 'true'
    or coalesce(new.result->>'cancelScope', '') = 'upstream_confirmed';

  select
    case
      when item.billing_unit = 'per_request'
        then greatest(1, least(1000, floor(coalesce(provider_request_count, 1))))::integer
      else ceil(coalesce(upstream_billed, output_duration, item.requested_seconds, 0))::integer
    end,
    case
      when item.billing_unit = 'per_request' and provider_request_count is not null then 'provider_request_count'
      when item.billing_unit = 'per_request' then 'request'
      when upstream_billed is not null and upstream_billed > 0 then 'upstream_billed'
      when output_duration is not null and output_duration > 0 then 'output_duration'
      when item.requested_seconds is not null and item.requested_seconds > 0 then 'requested_duration'
      else 'missing_duration'
    end
  into resolved_quantity, resolved_source
  from xh_task_cost_items item
  where item.task_id = new.id and item.cost_item_type = 'provider_cost';

  update xh_task_cost_items item
     set upstream_billed_seconds = upstream_billed,
         output_seconds = output_duration,
         quantity = case
           when new.status = 'failed' or (new.status = 'cancelled' and upstream_cancel_confirmed) then 0
           else coalesce(resolved_quantity, 0)
         end,
         quantity_source = coalesce(resolved_source, 'missing_duration'),
         amount = case
           when new.status = 'failed' or (new.status = 'cancelled' and upstream_cancel_confirmed) then 0
           when item.billing_unit = 'per_second' and coalesce(resolved_quantity, 0) = 0 then 0
           else item.unit_price * coalesce(resolved_quantity, 0)
         end,
         status = case
           when item.pricing_version_id is null then 'unpriced'
           when new.status = 'failed' or (new.status = 'cancelled' and upstream_cancel_confirmed) then 'not_charged'
           when item.billing_unit = 'per_second' and coalesce(resolved_quantity, 0) = 0 then 'unpriced'
           else 'charged'
         end,
         charge_reason = case
           when item.pricing_version_id is null then 'model_unpriced'
           when new.status = 'failed' then 'task_not_successful'
           when new.status = 'cancelled' and upstream_cancel_confirmed then 'upstream_cancelled'
           when item.billing_unit = 'per_second' and coalesce(resolved_quantity, 0) = 0 then 'missing_billable_seconds'
           when new.status = 'cancelled' then 'cancelled_without_upstream_confirmation'
           else 'task_succeeded'
         end,
         finalized_at = coalesce(item.finalized_at, new.finalized_at, now())
   where item.task_id = new.id
     and item.cost_item_type = 'provider_cost'
     and item.status = 'pending';

  return new;
end;
$$;
