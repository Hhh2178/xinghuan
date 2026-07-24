import {
  degradedCanvasRunAgentAnalysis,
  validateCanvasRunAgentAnalysis,
  type CanvasRunPlan,
} from "@xinghuan/agent-core";

export function createCanvasRunAgentAnalysisService(deps: {
  runPlanner: (input: {
    ownerId: string;
    analysisIdempotencyKey: string;
    maximumParallelism: number;
    graph: ReturnType<typeof sanitizedGraph>;
    prompt: string;
  }) => Promise<{ content: string; agentRunId?: string }>;
}) {
  async function analyzePlan(input: { ownerId: string; plan: CanvasRunPlan; maximumParallelism: number; analysisIdempotencyKey: string }) {
    const graph = sanitizedGraph(input.plan);
    try {
      const result = await deps.runPlanner({
        ownerId: input.ownerId,
        analysisIdempotencyKey: input.analysisIdempotencyKey,
        maximumParallelism: input.maximumParallelism,
        graph,
        prompt: buildPlannerPrompt(graph, input.maximumParallelism),
      });
      return {
        agentRunId: result.agentRunId,
        analysis: validateCanvasRunAgentAnalysis({
          plan: input.plan,
          maximumParallelism: input.maximumParallelism,
          response: parseJsonObject(result.content),
        }),
      };
    } catch (error) {
      return {
        analysis: degradedCanvasRunAgentAnalysis({
          plan: input.plan,
          maximumParallelism: input.maximumParallelism,
          reason: error instanceof Error ? error.message : "AGENT_ANALYSIS_UNAVAILABLE",
        }),
      };
    }
  }

  return { analyzePlan };
}

function sanitizedGraph(plan: CanvasRunPlan) {
  return {
    workflowId: plan.workflowId,
    workflowRevision: plan.workflowRevision,
    groups: plan.groups.map((group) => ({
      id: group.id,
      order: group.order,
      mode: group.mode || "serial",
      skipped: group.skipped,
      stepIds: [...group.stepIds],
    })),
    steps: plan.steps.map((step) => ({
      id: step.id,
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      groupId: step.groupId,
      dependsOn: [...step.dependsOn],
      skipped: step.skipped,
      executionLayer: step.executionLayer,
      providerName: safeConfigurationText(step.configuration, "providerName", "providerId"),
      modelName: safeConfigurationText(step.configuration, "modelName", "modelId", "modelRecordId"),
      estimatedRequestCount: estimatedStepRequests(step.configuration),
    })),
    executionLayers: (plan.executionLayers || []).map((layer) => ({ index: layer.index, stepIds: [...layer.stepIds] })),
  };
}

function buildPlannerPrompt(graph: ReturnType<typeof sanitizedGraph>, maximumParallelism: number) {
  return [
    "你是星幻无限画布的 AI 托管规划分析器。确定性依赖图和 executionLayers 是执行权威，你只能解释和建议，不能改变依赖或层。",
    `平台允许的最大并发: ${maximumParallelism}`,
    "只返回一个 JSON 对象，不要输出思考过程、Markdown 或额外说明。",
    '严格结构: {"summary":"...","concurrencyGroups":[{"stepIds":["step:..."],"reason":"..."}],"serialConstraints":[{"beforeStepId":"step:...","afterStepId":"step:...","reason":"..."}],"risks":["..."],"recommendedMaximumParallelism":1,"estimatedRequestCount":1}',
    "concurrencyGroups[].stepIds 只能引用同一 executionLayer 中互不依赖的既有 step ID。",
    "serialConstraints 必须是对象数组，只能解释已有先后关系；beforeStepId 和 afterStepId 必须引用既有 step ID。",
    "estimatedRequestCount 只汇总各 step 的 estimatedRequestCount，值为 0 的选择器、输出和确定性步骤不得计为 Provider 请求。",
    "不要添加、删除、重排或执行节点。",
    `脱敏工作流图: ${JSON.stringify(graph)}`,
  ].join("\n");
}

function parseJsonObject(content: string) {
  const text = String(content || "").trim();
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]?.trim() || "");
  for (const candidate of [...fenced.reverse(), text, ...extractJsonObjects(text).reverse()]) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
      // Continue to the next bounded object candidate.
    }
  }
  return null;
}

function extractJsonObjects(content: string) {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function safeConfigurationText(configuration: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = configuration?.[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 200);
  }
  return "";
}

function estimatedStepRequests(configuration: Record<string, unknown> | undefined) {
  if (typeof configuration?.taskCapability !== "string" || !configuration.taskCapability.trim()) return 0;
  const payload = configuration?.executionPayload;
  const count = payload && typeof payload === "object" && !Array.isArray(payload)
    ? Number((payload as Record<string, unknown>).generationCount)
    : 1;
  return Number.isInteger(count) ? Math.max(1, Math.min(4, count)) : 1;
}
