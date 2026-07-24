export type AssistantGovernanceSurface = "frontend" | "backend";

interface AssistantAgentKeys {
  frontendAssistantAgentKey: string;
  backendAssistantAgentKey: string;
}

export function assistantGovernanceAgentKey(settings: AssistantAgentKeys, surface: AssistantGovernanceSurface) {
  return surface === "frontend"
    ? settings.frontendAssistantAgentKey
    : settings.backendAssistantAgentKey;
}

export function selectAssistantDefinition<T extends { agentKey: string }>(
  definitions: T[],
  settings: AssistantAgentKeys,
  surface: AssistantGovernanceSurface,
) {
  const agentKey = assistantGovernanceAgentKey(settings, surface);
  return definitions.find((definition) => definition.agentKey === agentKey);
}

export function selectAssistantRoutePools<T extends { poolKey: string }>(pools: T[], surface: AssistantGovernanceSurface) {
  const poolKey = surface === "frontend" ? "assistant-diagnosis" : "admin-assistant-diagnosis";
  return pools.filter((pool) => pool.poolKey === poolKey);
}
