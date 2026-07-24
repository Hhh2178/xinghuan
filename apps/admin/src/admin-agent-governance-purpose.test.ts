import { describe, expect, it } from "vitest";
import { routePurpose } from "./admin-agent-governance-purpose.js";

describe("agent governance route purpose", () => {
  it("distinguishes assistant pools that share the same runtime scenario", () => {
    expect(routePurpose("planner", "assistant-chat", "assistant-diagnosis")?.label).toBe("助手诊断");
    expect(routePurpose("planner", "assistant-chat", "admin-assistant-diagnosis")?.label).toBe("后台助手诊断");
  });
});
