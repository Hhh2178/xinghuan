import { describe, expect, it } from "vitest";

import {
  collectWorkflowVariableReferences,
  createWorkflowInputSnapshot,
  extractWorkflowVariableTokenNames,
  normalizeWorkflowVariableName,
  normalizeWorkflowDocuments,
  parseWorkflowTextTemplate,
  renameWorkflowVariableToken,
  resolveWorkflowFieldBinding,
  validateWorkflowVariableDefinitions,
  workflowTextTemplateBinding,
  type WorkflowVariableDefinition,
} from "./workflow-variables.js";

const variables: WorkflowVariableDefinition[] = [
  { id: "var-theme", key: "主题", label: "主题", type: "text", required: true, version: 1, constraints: { minLength: 2, maxLength: 80 }, allowAiFill: false, allowAiRewrite: true },
  { id: "var-count", key: "数量", label: "数量", type: "number", required: false, defaultValue: 2, version: 1, constraints: { minimum: 1, maximum: 4 }, allowAiFill: false, allowAiRewrite: false },
  { id: "var-style", key: "Style", label: "风格", type: "select", required: true, defaultValue: "cinematic", version: 1, constraints: { options: ["cinematic", "documentary"] }, allowAiFill: false, allowAiRewrite: false },
  { id: "var-image", key: "参考图", label: "参考图", type: "image", required: true, version: 1, constraints: {}, allowAiFill: false, allowAiRewrite: false },
];

describe("workflow variables", () => {
  it("normalizes visually equivalent names and rejects duplicate or internal-only definitions", () => {
    expect(normalizeWorkflowVariableName("  ＳＴＹＬＥ  ")).toBe("style");
    expect(() => validateWorkflowVariableDefinitions([
      variables[2],
      { ...variables[2], id: "var-style-2", key: "Ｓｔｙｌｅ" },
    ])).toThrow("WORKFLOW_VARIABLE_NAME_CONFLICT:style");
    expect(() => validateWorkflowVariableDefinitions([
      { ...variables[0], key: "providerId" },
    ])).toThrow("WORKFLOW_VARIABLE_KEY_RESERVED:providerId");
  });

  it("parses shared workflow tokens into stable variable ids and preserves escaped markers", () => {
    expect(extractWorkflowVariableTokenNames("##主题## / ##主题## / \\##字面量## / ##风格##")).toEqual(["主题", "风格"]);
    const parsed = parseWorkflowTextTemplate("为 ##主题## 制作 ##主题## 海报，字面量 \\##保留##。", variables);
    expect(parsed.mode).toBe("template");
    expect(parsed.variableIds).toEqual(["var-theme"]);
    expect(parsed.segments).toEqual([
      { kind: "text", value: "为 " },
      { kind: "variable", variableId: "var-theme", key: "主题" },
      { kind: "text", value: " 制作 " },
      { kind: "variable", variableId: "var-theme", key: "主题" },
      { kind: "text", value: " 海报，字面量 ##保留##。" },
    ]);
    expect(parseWorkflowTextTemplate("##主题##", variables).mode).toBe("variable");
    expect(parseWorkflowTextTemplate("固定文本", variables).mode).toBe("fixed");
  });

  it("rejects unknown, empty, unclosed and non-text template tokens", () => {
    expect(() => parseWorkflowTextTemplate("##未知##", variables)).toThrow("WORKFLOW_VARIABLE_TOKEN_UNKNOWN:未知");
    expect(() => parseWorkflowTextTemplate("####", variables)).toThrow("WORKFLOW_VARIABLE_TOKEN_EMPTY");
    expect(() => parseWorkflowTextTemplate("##主题", variables)).toThrow("WORKFLOW_VARIABLE_TOKEN_UNCLOSED");
    expect(() => parseWorkflowTextTemplate("数量 ##数量##", variables)).toThrow("WORKFLOW_VARIABLE_TEMPLATE_TYPE_MISMATCH:数量:number");
  });

  it("renames matching workflow tokens without changing escaped literals or similar names", () => {
    expect(renameWorkflowVariableToken(
      "##主题## / ##主题风格## / \\##主题## / ##ＴＨＥＭＥ##",
      "theme",
      "视觉主题",
    )).toBe("##主题## / ##主题风格## / \\##主题## / ##视觉主题##");
    expect(renameWorkflowVariableToken("开场 ##主题##，结尾 ##主题##", "主题", "主体设定"))
      .toBe("开场 ##主体设定##，结尾 ##主体设定##");
  });

  it("creates a typed immutable input snapshot using provided values and defaults", () => {
    const snapshot = createWorkflowInputSnapshot({
      workflowId: "workflow-1",
      workflowRevision: 7,
      variables,
      values: {
        "var-theme": "夜景",
        style: "documentary",
        "var-image": { kind: "image", assetId: "asset-1" },
      },
    });
    expect(snapshot).toEqual({
      schemaVersion: 1,
      workflowId: "workflow-1",
      workflowRevision: 7,
      variables: [
        { id: "var-theme", key: "主题", type: "text", value: "夜景", source: "provided" },
        { id: "var-count", key: "数量", type: "number", value: 2, source: "default" },
        { id: "var-style", key: "Style", type: "select", value: "documentary", source: "provided" },
        { id: "var-image", key: "参考图", type: "image", value: { kind: "image", assetId: "asset-1" }, source: "provided" },
      ],
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.variables)).toBe(true);
    expect(Object.isFrozen(snapshot.variables[3].value)).toBe(true);
  });

  it("rejects missing required values, type mismatches and constraint violations", () => {
    expect(() => createWorkflowInputSnapshot({ workflowId: "workflow-1", workflowRevision: 1, variables, values: {} })).toThrow("WORKFLOW_VARIABLE_VALUE_REQUIRED:主题");
    expect(() => createWorkflowInputSnapshot({ workflowId: "workflow-1", workflowRevision: 1, variables, values: { 主题: "夜景", Style: "cinematic", 参考图: { kind: "video", assetId: "asset-1" } } })).toThrow("WORKFLOW_VARIABLE_VALUE_TYPE_MISMATCH:参考图:image");
    expect(() => createWorkflowInputSnapshot({ workflowId: "workflow-1", workflowRevision: 1, variables, values: { 主题: "夜景", 数量: 9, Style: "cinematic", 参考图: { kind: "image", assetId: "asset-1" } } })).toThrow("WORKFLOW_VARIABLE_VALUE_MAXIMUM:数量:4");
    expect(() => createWorkflowInputSnapshot({ workflowId: "workflow-1", workflowRevision: 1, variables, values: { 主题: "夜景", Style: "unknown", 参考图: { kind: "image", assetId: "asset-1" } } })).toThrow("WORKFLOW_VARIABLE_VALUE_OPTION_INVALID:Style:unknown");
    expect(() => createWorkflowInputSnapshot({ workflowId: "workflow-1", workflowRevision: 1, variables, values: { 主题: "夜景", Style: "cinematic", 参考图: { kind: "image", assetId: "asset-1" }, 未知: "静默忽略会掩盖调用错误" } })).toThrow("WORKFLOW_VARIABLE_VALUE_UNKNOWN:未知");
  });

  it("resolves stable-id bindings from the immutable snapshot", () => {
    const template = parseWorkflowTextTemplate("主题：##主题##", variables);
    const snapshot = createWorkflowInputSnapshot({
      workflowId: "workflow-1",
      workflowRevision: 3,
      variables,
      values: { 主题: "海边", Style: "cinematic", 参考图: { kind: "image", assetId: "asset-1" } },
    });
    expect(resolveWorkflowFieldBinding({
      fieldType: "text",
      binding: workflowTextTemplateBinding(template),
      fixedValue: template.source,
      snapshot,
    })).toBe("主题：海边");
    expect(resolveWorkflowFieldBinding({
      fieldType: "image",
      binding: { mode: "variable", variableId: "var-image" },
      fixedValue: null,
      snapshot,
    })).toEqual({ kind: "image", assetId: "asset-1" });
    expect(() => resolveWorkflowFieldBinding({
      fieldType: "video",
      binding: { mode: "variable", variableId: "var-image" },
      fixedValue: null,
      snapshot,
    })).toThrow("WORKFLOW_VARIABLE_BINDING_TYPE_MISMATCH:var-image:video");
  });

  it("normalizes workflow-level registries, draft values and node field bindings", () => {
    const workflows = normalizeWorkflowDocuments([{
      schemaVersion: 1,
      id: "workflow-1",
      name: "海报工作流",
      revision: 3,
      memberNodeIds: ["text-1", "upload-1", "text-1"],
      variables,
      inputValues: {
        "var-theme": "夜景",
        "var-image": { kind: "image", assetId: "asset-1" },
      },
      bindings: [
        {
          nodeId: "text-1",
          fieldPath: "prompt",
          fieldType: "text",
          binding: workflowTextTemplateBinding(parseWorkflowTextTemplate("主题：##主题##", variables)),
        },
        {
          nodeId: "upload-1",
          fieldPath: "input.reference_image",
          fieldType: "image",
          binding: { mode: "variable", variableId: "var-image" },
        },
      ],
    }]);

    expect(workflows).toEqual([expect.objectContaining({
      id: "workflow-1",
      memberNodeIds: ["text-1", "upload-1"],
      inputValues: {
        "var-theme": "夜景",
        "var-image": { kind: "image", assetId: "asset-1" },
      },
    })]);
    expect(collectWorkflowVariableReferences(workflows[0])).toEqual({
      "var-theme": ["text-1"],
      "var-image": ["upload-1"],
    });
  });

  it("rejects invalid workflow membership and binding contracts", () => {
    const base = {
      schemaVersion: 1,
      id: "workflow-1",
      name: "工作流",
      revision: 1,
      memberNodeIds: ["text-1"],
      variables,
      inputValues: {},
    };
    expect(() => normalizeWorkflowDocuments([{ ...base, bindings: [{
      nodeId: "outside",
      fieldPath: "prompt",
      fieldType: "text",
      binding: { mode: "variable", variableId: "var-theme" },
    }] }])).toThrow("WORKFLOW_BINDING_NODE_OUTSIDE:outside");
    expect(() => normalizeWorkflowDocuments([{ ...base, bindings: [{
      nodeId: "text-1",
      fieldPath: "prompt",
      fieldType: "video",
      binding: { mode: "variable", variableId: "var-image" },
    }] }])).toThrow("WORKFLOW_BINDING_TYPE_MISMATCH:var-image:video");
    expect(() => normalizeWorkflowDocuments([{ ...base, bindings: [{
      nodeId: "text-1",
      fieldPath: "prompt",
      fieldType: "text",
      binding: { mode: "variable", variableId: "unknown" },
    }] }])).toThrow("WORKFLOW_BINDING_VARIABLE_UNKNOWN:unknown");
  });
});
