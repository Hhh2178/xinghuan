import type { BillingUnit, TaskCostStatus } from "./task-cost-domain.js";

export interface MemberTaskCostItem {
  taskId: string;
  pricingVersionId: string;
  modelId: string;
  status: TaskCostStatus;
  amount: string;
  currency: string;
  billingUnit: BillingUnit | "";
  quantity: number;
  chargeReason: string;
}

export interface MemberTaskCostSummary {
  visible: boolean;
  status: TaskCostStatus | "mixed";
  taskIds: string[];
  modelIds: string[];
  billingUnits: BillingUnit[];
  totals: Array<{ currency: string; amount: string }>;
  chargeReasons: string[];
}

export function buildMemberTaskCostSummary(items: MemberTaskCostItem[]): MemberTaskCostSummary {
  const configuredItems = items.filter((item) => Boolean(item.pricingVersionId));
  if (configuredItems.length === 0) return emptyMemberTaskCostSummary();

  const statuses = new Set(configuredItems.map((item) => item.status));
  const status = statuses.has("pending")
    ? "pending"
    : statuses.size === 1
      ? configuredItems[0].status
      : statuses.has("unpriced")
        ? "unpriced"
        : "mixed";
  const totals = new Map<string, bigint>();
  for (const item of configuredItems) {
    const currency = normalizeCurrency(item.currency);
    totals.set(currency, (totals.get(currency) || 0n) + parseDecimal6(item.amount));
  }

  return {
    visible: true,
    status,
    taskIds: unique(configuredItems.map((item) => item.taskId)),
    modelIds: unique(configuredItems.map((item) => item.modelId).filter(Boolean)),
    billingUnits: unique(configuredItems.map((item) => item.billingUnit).filter(isBillingUnit)),
    totals: [...totals.entries()].map(([currency, amount]) => ({ currency, amount: formatDecimal6(amount) })),
    chargeReasons: unique(configuredItems.map((item) => item.chargeReason).filter(Boolean)),
  };
}

export function emptyMemberTaskCostSummary(): MemberTaskCostSummary {
  return {
    visible: false,
    status: "unpriced",
    taskIds: [],
    modelIds: [],
    billingUnits: [],
    totals: [],
    chargeReasons: [],
  };
}

function parseDecimal6(value: string): bigint {
  const match = String(value || "0").trim().match(/^(\d+)(?:\.(\d{0,6}))?$/);
  if (!match) return 0n;
  return BigInt(match[1]) * 1_000_000n + BigInt((match[2] || "").padEnd(6, "0"));
}

function formatDecimal6(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = String(value % 1_000_000n).padStart(6, "0");
  return `${whole}.${fraction}`;
}

function normalizeCurrency(value: string): string {
  const currency = String(value || "CNY").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "CNY";
}

function isBillingUnit(value: BillingUnit | ""): value is BillingUnit {
  return value === "per_request" || value === "per_second";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
