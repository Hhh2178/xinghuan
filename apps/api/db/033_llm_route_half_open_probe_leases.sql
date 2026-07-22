create table if not exists xh_llm_route_entry_probe_leases (
  route_entry_id text primary key references xh_llm_route_entries(id) on delete cascade,
  lease_owner text not null,
  lease_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_xh_llm_route_entry_probe_leases_expiry
  on xh_llm_route_entry_probe_leases(lease_expires_at);
