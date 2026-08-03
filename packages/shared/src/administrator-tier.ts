export const ADMINISTRATOR_TIERS = ["root", "operator"] as const;
export type AdministratorTier = (typeof ADMINISTRATOR_TIERS)[number];

export function normalizeAdministratorTier(
  role: "admin" | "member",
  value: unknown,
): AdministratorTier | undefined {
  if (role !== "admin") return undefined;
  return value === "operator" ? "operator" : "root";
}

export function isRootAdministrator(user: { role: string; administratorTier?: string } | null | undefined) {
  return user?.role === "admin" && normalizeAdministratorTier("admin", user.administratorTier) === "root";
}

export function isOperatorAdministrator(user: { role: string; administratorTier?: string } | null | undefined) {
  return user?.role === "admin" && normalizeAdministratorTier("admin", user.administratorTier) === "operator";
}
