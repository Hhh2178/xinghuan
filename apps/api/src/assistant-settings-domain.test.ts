import { describe, expect, it } from "vitest";
import {
  assistantAgentKeyForScope,
  defaultAssistantSettings,
  normalizeAssistantSettings,
} from "./assistant-settings-domain.js";

describe("assistant settings domain", () => {
  it("uses separate frontend and backend assistant definitions by default", () => {
    const settings = defaultAssistantSettings(1_000);

    expect(settings.integration.frontendAssistantAgentKey).toBe("assistant-planner");
    expect(settings.integration.backendAssistantAgentKey).toBe("admin-assistant-planner");
  });

  it("reads the retired shared key only when a scoped key is absent", () => {
    const settings = normalizeAssistantSettings({
      integration: {
        assistantAgentKey: "legacy-shared-assistant",
        frontendAssistantAgentKey: "frontend-explicit",
      },
    });

    expect(settings.integration.frontendAssistantAgentKey).toBe("frontend-explicit");
    expect(settings.integration.backendAssistantAgentKey).toBe("legacy-shared-assistant");
    expect(settings.integration).not.toHaveProperty("assistantAgentKey");
  });

  it("selects the assistant definition from the request scope", () => {
    const settings = normalizeAssistantSettings({
      integration: {
        frontendAssistantAgentKey: "frontend-agent",
        backendAssistantAgentKey: "backend-agent",
      },
    });

    expect(assistantAgentKeyForScope(settings, "canvas")).toBe("frontend-agent");
    expect(assistantAgentKeyForScope(settings, "admin")).toBe("backend-agent");
  });
});
