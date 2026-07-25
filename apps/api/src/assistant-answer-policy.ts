export type AssistantDetailLevel = "brief" | "technical";

const TECHNICAL_DETAIL_REQUEST = [
  /(?:技术码|错误码|任务\s*id|节点\s*id|运行\s*id|step\s*id|task\s*id|run\s*id)/i,
  /(?:原始|完整|详细).{0,12}(?:json|参数|字段|日志|响应|请求|标识|id)/i,
  /(?:展示|列出|给我|提供).{0,12}(?:provenance|溯源字段|调试日志|堆栈|技术细节|参数明细)/i,
];

export function resolveAssistantDetailLevel(input: {
  message: string;
  scope: "canvas" | "admin";
}): AssistantDetailLevel {
  void input.scope;
  const message = String(input.message || "").trim();
  return TECHNICAL_DETAIL_REQUEST.some((pattern) => pattern.test(message)) ? "technical" : "brief";
}

export function buildAssistantAnswerPolicyPrompt(detailLevel: AssistantDetailLevel): string {
  if (detailLevel === "technical") {
    return [
      "当前为技术详情模式：先给结论，再按用户明确要求补充技术证据。",
      "允许展示原始标识、技术码、字段或 JSON，但只展示与本问题直接相关的最小集合。",
      "不得输出密钥、令牌、Cookie、授权头、签名链接或其他敏感信息。",
      "严格区分已观察事实与推断，不得把猜测或建议描述成已执行动作。",
      "失败诊断可以明确分为已观察事实、可能原因、影响和修复动作。",
    ].join("\n");
  }
  return [
    "当前为默认简洁模式：先用一句明确结论回答用户。",
    "结论后最多 3 个可执行动作；能一句话说明的原因不要拆成参数化报告。",
    "主回答不得输出原始 ID、技术字段清单或内部参数；使用用户可见的节点名称。",
    "主回答不得输出 JSON、请求体、响应体或调试日志。",
    "失败诊断也不要默认拆成多段诊断报告；把已知事实和最可能原因压缩进结论，再给修复动作。",
    "只有用户明确追问技术细节时，才建议其请求技术详情。",
  ].join("\n");
}
