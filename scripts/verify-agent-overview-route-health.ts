import assert from 'node:assert/strict';

import { createAgentGovernanceRepository } from '../apps/api/src/agent-governance-repository';

const queries: Array<{ sql: string; values?: unknown[] }> = [];
const repository = createAgentGovernanceRepository({
  getPostgresPool: async () => ({
    query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      return { rows: [{}] };
    },
  }) as never,
});

await repository.readOverview('gray');
const overview = queries[0];
assert.ok(overview);
assert.deepEqual(overview.values, ['gray']);
assert.match(overview.sql, /xh_llm_route_pool_publications\s+pub/i);
assert.match(overview.sql, /pub\.environment\s*=\s*\$1/i);
assert.match(overview.sql, /pub\.retired_at\s+is\s+null/i);
assert.match(overview.sql, /xh_llm_route_pool_versions\s+pv/i);
assert.match(overview.sql, /pv\.status\s*=\s*'approved'/i);
assert.match(overview.sql, /xh_llm_route_pools\s+p/i);
assert.match(overview.sql, /p\.enabled\s*=\s*true/i);
assert.match(overview.sql, /xh_llm_route_entries\s+e/i);
assert.match(overview.sql, /e\.enabled\s*=\s*true/i);
assert.match(overview.sql, /count\(distinct\s+e\.id\)/i);

console.log('verify-agent-overview-route-health: ok');
