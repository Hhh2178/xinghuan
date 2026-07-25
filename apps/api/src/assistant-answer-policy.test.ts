import { describe, expect, it } from "vitest";

import { buildAssistantAnswerPolicyPrompt, resolveAssistantDetailLevel } from "./assistant-answer-policy.js";

describe("assistant answer policy", () => {
  it("defaults ordinary help requests to a concise answer", () => {
    expect(resolveAssistantDetailLevel({ message: "这个错误怎么处理", scope: "canvas" })).toBe("brief");
    expect(resolveAssistantDetailLevel({ message: "为什么候选选择失败了", scope: "admin" })).toBe("brief");

    const prompt = buildAssistantAnswerPolicyPrompt("brief");
    expect(prompt).toContain("一句明确结论");
    expect(prompt).toContain("最多 3 个");
    expect(prompt).toContain("不得输出原始 ID");
    expect(prompt).toContain("不得输出 JSON");
    expect(prompt).toContain("不要默认拆成多段诊断报告");
  });

  it("uses technical detail only when the user explicitly requests it", () => {
    expect(resolveAssistantDetailLevel({ message: "给我技术码、任务 ID 和 provenance 字段", scope: "canvas" })).toBe("technical");
    expect(resolveAssistantDetailLevel({ message: "展开原始 JSON 和调试日志", scope: "admin" })).toBe("technical");
    expect(resolveAssistantDetailLevel({ message: "请简单说一下任务为什么失败", scope: "canvas" })).toBe("brief");

    const prompt = buildAssistantAnswerPolicyPrompt("technical");
    expect(prompt).toContain("允许展示原始标识");
    expect(prompt).toContain("不得输出密钥");
    expect(prompt).toContain("事实与推断");
    expect(prompt).toContain("已观察事实、可能原因、影响和修复动作");
  });
});
