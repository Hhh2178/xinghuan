import { describe, expect, it, vi } from "vitest";

import { createAgentRuntimeConfigurationRepository } from "./agent-runtime-configuration-repository.js";

describe("Agent runtime configuration repository", () => {
  it("resolves exactly one approved active publication for the requested environment", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("from xh_agent_definitions")) {
        expect(sql).toContain("cv.status = 'approved'");
        expect(sql).toContain("cp.retired_at is null");
        expect(sql).toContain("cp.environment = $3");
        expect(params).toEqual(["assistant-planner", "planner", "gray"]);
        return { rows: [{
          agent_definition_id: "definition-1",
          configuration_version_id: "configuration-3",
          configuration_version: 3,
          configuration: { llmPoolKey: "assistant-pool", maxTokens: 6000, timeoutMs: 45000, toolAllowlist: ["knowledge.node.get"] },
        }] };
      }
      expect(sql).toContain("subject_type = 'platform'");
      expect(sql).toContain("subject_id is null");
      expect(params).toEqual([["knowledge.node.get"]]);
      return { rows: [{ tool_name: "knowledge.node.get", effect: "deny", constraints: { maximumCallsPerRun: 0 }, revision: 4 }] };
    });
    const repository = createAgentRuntimeConfigurationRepository({ getPostgresPool: async () => ({ query } as any) });
    await expect(repository.readPublishedConfiguration({ agentKey: "assistant-planner", role: "planner", environment: "gray" })).resolves.toMatchObject({
      agentDefinitionId: "definition-1",
      configurationVersionId: "configuration-3",
      configuration: { llmPoolKey: "assistant-pool", maxTokens: 6000, timeoutMs: 45000, toolAllowlist: ["knowledge.node.get"] },
      platformToolPolicies: [{ toolName: "knowledge.node.get", effect: "deny", constraints: { maximumCallsPerRun: 0 }, revision: 4 }],
    });
  });
});
