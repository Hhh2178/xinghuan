import { describe, expect, it } from "vitest";
import {
  isOperatorAdministrator,
  isRootAdministrator,
  normalizeAdministratorTier,
} from "./administrator-tier.js";

describe("administrator tier", () => {
  it("maps legacy administrators to root", () => {
    expect(normalizeAdministratorTier("admin", undefined)).toBe("root");
  });

  it("keeps explicit operators", () => {
    expect(normalizeAdministratorTier("admin", "operator")).toBe("operator");
  });

  it("removes tiers from members", () => {
    expect(normalizeAdministratorTier("member", "root")).toBeUndefined();
  });

  it("distinguishes root and operator administrators", () => {
    expect(isRootAdministrator({ role: "admin" })).toBe(true);
    expect(isOperatorAdministrator({ role: "admin", administratorTier: "operator" })).toBe(true);
  });
});
