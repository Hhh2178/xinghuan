import { describe, expect, it } from "vitest";
import {
  assistantGovernanceAgentKey,
  selectAssistantDefinition,
  selectAssistantRoutePools,
  type AssistantGovernanceSurface,
} from "./admin-assistant-governance-view-model.js";

describe("assistant governance view model", () => {
  const settings = {
    frontendAssistantAgentKey: "assistant-planner",
    backendAssistantAgentKey: "admin-assistant-planner",
  };

  it.each<[AssistantGovernanceSurface, string]>([
    ["frontend", "assistant-planner"],
    ["backend", "admin-assistant-planner"],
  ])("resolves the %s assistant definition", (surface, expected) => {
    expect(assistantGovernanceAgentKey(settings, surface)).toBe(expected);
    expect(selectAssistantDefinition([
      { agentKey: "assistant-planner" },
      { agentKey: "admin-assistant-planner" },
      { agentKey: "generation-recovery" },
    ], settings, surface)?.agentKey).toBe(expected);
  });

  it("keeps frontend and backend route pools visually separate", () => {
    const pools = [
      { poolKey: "assistant-diagnosis" },
      { poolKey: "admin-assistant-diagnosis" },
      { poolKey: "generation-recovery" },
    ];

    expect(selectAssistantRoutePools(pools, "frontend").map((pool) => pool.poolKey)).toEqual(["assistant-diagnosis"]);
    expect(selectAssistantRoutePools(pools, "backend").map((pool) => pool.poolKey)).toEqual(["admin-assistant-diagnosis"]);
  });
});
