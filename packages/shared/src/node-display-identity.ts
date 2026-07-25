export interface NodeDisplayIdentity {
  label: string;
  suffix: string;
  displayName: string;
}

export function resolveNodeDisplayIdentity(input: {
  nodeId: string;
  nodeType?: string;
  customLabel?: unknown;
  catalogLabel?: string;
}): NodeDisplayIdentity {
  const label = cleanLabel(input.customLabel)
    || cleanLabel(input.catalogLabel)
    || "未知节点";
  const tokens = String(input.nodeId || "").split("-").filter((token) => token.length > 0);
  const finalToken = tokens.at(-1) || "";
  const tokenSuffix = finalToken.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const fullIdSuffix = String(input.nodeId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-8);
  const suffix = tokenSuffix || fullIdSuffix || "node";

  return {
    label,
    suffix,
    displayName: `${label} #${suffix}`,
  };
}

function cleanLabel(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
