import { describe, expect, it, vi } from "vitest";
import { createPermissionRuntime } from "./permission-runtime.js";

const member = { id: "member-a", role: "member" as const, groupId: "group-a" };
const admin = { id: "admin-a", role: "admin" as const, groupId: "group-a" };

describe("permission runtime", () => {
  it("keeps legacy authoritative without evaluating unified permissions", async () => {
    const canUnified = vi.fn(async () => ({ allowed: false, reason: "no-matching-rule" as const }));
    const runtime = createPermissionRuntime({ mode: "legacy", canUnified });

    await expect(runtime.decide({
      user: member,
      subjectKey: "provider.model/model-a",
      action: "view",
      legacyAllowed: true,
    })).resolves.toMatchObject({ allowed: true, authority: "legacy" });
    expect(canUnified).not.toHaveBeenCalled();
  });

  it("records a shadow mismatch while keeping the legacy result authoritative", async () => {
    const onShadowMismatch = vi.fn(async () => undefined);
    const runtime = createPermissionRuntime({
      mode: "shadow",
      canUnified: async () => ({ allowed: false, reason: "subject-not-published" }),
      onShadowMismatch,
    });

    await expect(runtime.decide({
      user: member,
      subjectKey: "runninghub.app/app-a",
      action: "view",
      legacyAllowed: true,
    })).resolves.toMatchObject({
      allowed: true,
      authority: "legacy",
      mismatch: true,
      unified: { allowed: false, reason: "subject-not-published" },
    });
    expect(onShadowMismatch).toHaveBeenCalledTimes(1);
  });

  it("uses unified permissions in enforced mode", async () => {
    const runtime = createPermissionRuntime({
      mode: "enforced",
      canUnified: async () => ({ allowed: true, reason: "group-rule", ruleId: "rule-a" }),
    });

    await expect(runtime.decide({
      user: member,
      subjectKey: "provider.model/model-a",
      action: "execute",
      legacyAllowed: false,
    })).resolves.toMatchObject({
      allowed: true,
      authority: "unified",
      unified: { ruleId: "rule-a" },
    });
  });

  it("always permits administrators without recording a mismatch", async () => {
    const onShadowMismatch = vi.fn(async () => undefined);
    const canUnified = vi.fn(async () => ({ allowed: false, reason: "subject-not-published" as const }));
    const runtime = createPermissionRuntime({ mode: "shadow", canUnified, onShadowMismatch });

    await expect(runtime.decide({
      user: admin,
      subjectKey: "provider.model/model-a",
      action: "view",
      legacyAllowed: false,
    })).resolves.toMatchObject({ allowed: true, authority: "admin" });
    expect(canUnified).not.toHaveBeenCalled();
    expect(onShadowMismatch).not.toHaveBeenCalled();
  });
});
