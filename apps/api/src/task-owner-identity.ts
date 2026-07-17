export const TASK_OWNER_ID_SQL =
  "coalesce(nullif(t.owner_id, ''), nullif(t.payload->>'userId', ''), nullif(t.result->>'userId', ''))";
