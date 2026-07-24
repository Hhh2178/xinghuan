import type { PoolClient } from "pg";

const QUALITY_GOVERNANCE_UNAVAILABLE_PREFIXES = [
  "ARTIFACT_QUALITY_PROFILE_NOT_PUBLISHED:",
  "LLM_ROUTE_POOL_NOT_PUBLISHED:",
  "LLM_ROUTE_UNAVAILABLE:",
  "AGENT_CONFIGURATION_UNAVAILABLE:",
] as const;

export async function settleWithQualitySavepoint(input: {
  client: Pick<PoolClient, "query">;
  settleSuccessful: () => Promise<void>;
  settleFailed: (reason: string) => Promise<void>;
}) {
  await input.client.query("savepoint canvas_quality_settlement");
  try {
    await input.settleSuccessful();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await input.client.query("rollback to savepoint canvas_quality_settlement");
    await input.client.query("release savepoint canvas_quality_settlement");
    await input.settleFailed(reason);
    return;
  }
  await input.client.query("release savepoint canvas_quality_settlement");
}

export function qualityGovernanceUnavailableReason(error: unknown) {
  const reason = error instanceof Error ? error.message : String(error);
  return QUALITY_GOVERNANCE_UNAVAILABLE_PREFIXES.some((prefix) => reason.startsWith(prefix)) ? reason : "";
}

export function smartCandidateUnavailableDisposition(context: { smartCandidateSelector?: Record<string, unknown> }) {
  const selector = context.smartCandidateSelector;
  if (!selector || !Object.keys(selector).length) return "not_smart" as const;
  return selector.lowConfidencePolicy === "stop" ? "stop" as const : "manual" as const;
}

export async function runQualitySettlementStage<T>(stage: string, operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`CANVAS_RUN_QUALITY_SETTLEMENT_FAILED:${stage}:${reason}`, { cause: error });
  }
}
