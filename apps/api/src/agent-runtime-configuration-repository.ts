import { normalizeAgentRuntimeConfiguration, type AgentRole } from "@xinghuan/agent-core";
import type { Pool } from "pg";

export function createAgentRuntimeConfigurationRepository(deps: { getPostgresPool: () => Promise<Pool> }) {
  async function readPublishedConfiguration(input: {
    agentKey: string;
    role: AgentRole;
    environment: "gray" | "production";
  }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select d.id as agent_definition_id, cv.id as configuration_version_id,
        cv.version as configuration_version, cv.configuration
       from xh_agent_definitions d
       join xh_agent_configuration_versions cv on cv.agent_definition_id = d.id and cv.status = 'approved'
       join xh_agent_configuration_publications cp on cp.configuration_version_id = cv.id
         and cp.environment = $3 and cp.retired_at is null
       where d.agent_key = $1 and d.role = $2 and d.enabled = true
       order by cv.version desc limit 1`,
      [input.agentKey, input.role, input.environment],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`AGENT_CONFIGURATION_UNAVAILABLE:${input.agentKey}:${input.environment}`);
    const configuration = normalizeAgentRuntimeConfiguration(row.configuration);
    const platformPolicies = configuration.toolAllowlist.length > 0
      ? await pool.query(
        `select tool_name, effect, constraints, revision
         from xh_agent_tool_policies
         where subject_type = 'platform' and subject_id is null and tool_name = any($1::text[])
         order by tool_name`,
        [configuration.toolAllowlist],
      )
      : { rows: [] };
    return {
      agentDefinitionId: String(row.agent_definition_id),
      configurationVersionId: String(row.configuration_version_id),
      version: Number(row.configuration_version),
      configuration,
      platformToolPolicies: platformPolicies.rows.map((policy) => ({
        toolName: String(policy.tool_name),
        effect: policy.effect as "allow" | "deny" | "require_approval",
        constraints: record(policy.constraints),
        revision: Number(policy.revision),
      })),
    };
  }

  return { readPublishedConfiguration };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
