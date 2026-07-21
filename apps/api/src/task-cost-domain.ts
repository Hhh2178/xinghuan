export type BillingUnit = "per_request" | "per_second";
export type TaskCostStatus = "pending" | "charged" | "not_charged" | "unpriced";
export type TaskCostQuantitySource = "request" | "upstream_billed" | "output_duration" | "requested_duration" | "missing_duration";

export interface ModelPricingInput {
  enabled?: unknown;
  billingUnit?: unknown;
  unitPrice?: unknown;
  currency?: unknown;
  note?: unknown;
}

export function normalizeModelPricingInput(input: ModelPricingInput) {
  const billingUnit: BillingUnit = input.billingUnit === "per_second" ? "per_second" : "per_request";
  const currency = String(input.currency || "CNY").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("币种必须是 3 位大写代码");
  return {
    billingUnit,
    currency,
    enabled: input.enabled !== false,
    note: String(input.note || "").trim().slice(0, 500),
    unitPrice: formatDecimal(parseDecimalMicros(input.unitPrice ?? "0")),
  };
}

export function resolveBillableSeconds(input: {
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
}): { quantity: number; source: TaskCostQuantitySource } {
  const payload = plainObject(input.payload);
  const result = plainObject(input.result);
  const raw = plainObject(result.raw);
  const candidates: Array<[unknown, TaskCostQuantitySource]> = [
    [result.billedSeconds ?? result.billingSeconds ?? raw.billedSeconds ?? raw.billingSeconds, "upstream_billed"],
    [result.outputDurationSeconds ?? result.durationSeconds ?? raw.outputDurationSeconds ?? raw.durationSeconds, "output_duration"],
    [payload.durationSeconds ?? payload.duration ?? plainObject(payload.params).durationSeconds ?? plainObject(payload.params).duration, "requested_duration"],
  ];
  for (const [value, source] of candidates) {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds > 0) return { quantity: Math.ceil(seconds), source };
  }
  return { quantity: 0, source: "missing_duration" };
}

export function finalizeTaskCost(input: {
  status: string;
  billingUnit: BillingUnit;
  unitPrice: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
}) {
  const result = plainObject(input.result);
  const upstreamCancelled = result.upstreamCancelled === true || result.cancelScope === "upstream_confirmed";
  const chargeable = input.status === "succeeded" || (input.status === "cancelled" && !upstreamCancelled);
  const chargeReason = input.status === "succeeded"
    ? "task_succeeded"
    : upstreamCancelled
      ? "upstream_cancelled"
      : input.status === "cancelled"
        ? "cancelled_without_upstream_confirmation"
        : "task_not_successful";
  if (!chargeable) {
    return { status: "not_charged" as const, quantity: 0, amount: "0.000000", quantitySource: input.billingUnit === "per_request" ? "request" : "missing_duration", chargeReason };
  }
  const resolved = input.billingUnit === "per_request"
    ? { quantity: 1, source: "request" as const }
    : resolveBillableSeconds({ payload: input.payload, result });
  const amountMicros = parseDecimalMicros(input.unitPrice) * BigInt(resolved.quantity);
  return {
    status: "charged" as const,
    quantity: resolved.quantity,
    amount: formatDecimal(amountMicros),
    quantitySource: resolved.source,
    chargeReason,
  };
}

function parseDecimalMicros(value: unknown): bigint {
  const text = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new Error("单价必须是非负数，最多 6 位小数");
  const [whole, fraction = ""] = text.split(".");
  const micros = BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
  if (micros > 999_999_999_999_999n) throw new Error("单价超出允许范围");
  return micros;
}

function formatDecimal(micros: bigint) {
  const whole = micros / 1_000_000n;
  const fraction = String(micros % 1_000_000n).padStart(6, "0");
  return `${whole}.${fraction}`;
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
