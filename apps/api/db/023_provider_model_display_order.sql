alter table xh_providers
  add column if not exists sort_order integer not null default 0;

alter table xh_models
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select id, (row_number() over (order by created_at desc, id asc) - 1) * 10 as next_order
  from xh_providers
)
update xh_providers as provider
set sort_order = ranked.next_order
from ranked
where provider.id = ranked.id;

with ranked as (
  select
    id,
    (row_number() over (
      partition by provider_id, capability
      order by created_at desc, id asc
    ) - 1) * 10 as next_order
  from xh_models
)
update xh_models as model
set sort_order = ranked.next_order
from ranked
where model.id = ranked.id;

create index if not exists idx_xh_providers_sort_order
  on xh_providers(sort_order asc, created_at desc, id asc);

create index if not exists idx_xh_models_provider_capability_sort_order
  on xh_models(provider_id, capability, sort_order asc, created_at desc, id asc);
