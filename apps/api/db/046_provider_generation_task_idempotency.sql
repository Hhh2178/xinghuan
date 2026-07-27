create unique index if not exists idx_xh_tasks_owner_generation_idempotency
  on xh_tasks(owner_id, (payload->>'idempotencyKey'))
  where owner_id is not null and nullif(payload->>'idempotencyKey', '') is not null;
