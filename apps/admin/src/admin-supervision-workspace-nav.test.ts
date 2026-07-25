import { describe, expect, it } from "vitest";

import {
  createSupervisionWorkspaceState,
  discardSupervisionWorkspaceDraft,
  requestSupervisionWorkspace,
  resolveSupervisionWorkspaceKey,
  supervisionWorkspaceItems,
  updateSupervisionWorkspaceDirty,
} from "./admin-supervision-workspace-nav";

describe("Admin supervision workspace navigation", () => {
  it("uses overview as the stable default workspace", () => {
    expect(resolveSupervisionWorkspaceKey()).toBe("overview");
    expect(createSupervisionWorkspaceState()).toEqual({
      active: "overview",
      pending: null,
      dirty: false,
    });
  });

  it.each([
    ["controls", "environment"],
    ["roles", "planner"],
    ["llm-routes", "routing"],
    ["quality", "quality"],
    ["recovery", "recovery"],
    ["unknown", "overview"],
  ] as const)("maps legacy deep link %s to %s", (segment, expected) => {
    expect(resolveSupervisionWorkspaceKey(segment)).toBe(expected);
  });

  it("reads a legacy workspace key from a complete deep link", () => {
    expect(resolveSupervisionWorkspaceKey("/admin/capabilities/agent-runtime/supervision?workspace=llm-routes"))
      .toBe("routing");
  });

  it("marks exactly one workspace as selected", () => {
    const selected = supervisionWorkspaceItems("quality").filter((item) => item.selected);

    expect(selected).toHaveLength(1);
    expect(selected[0]?.key).toBe("quality");
  });

  it("switches immediately when the active workspace is clean", () => {
    const next = requestSupervisionWorkspace(createSupervisionWorkspaceState("overview"), "planner");

    expect(next).toEqual({ active: "planner", pending: null, dirty: false });
  });

  it("keeps state identity when the dirty flag does not change", () => {
    const state = createSupervisionWorkspaceState("planner");

    expect(updateSupervisionWorkspaceDirty(state, false)).toBe(state);
  });

  it("keeps the dirty workspace active until discard is confirmed", () => {
    const dirty = updateSupervisionWorkspaceDirty(createSupervisionWorkspaceState("routing"), true);
    const requested = requestSupervisionWorkspace(dirty, "quality");

    expect(requested).toEqual({ active: "routing", pending: "quality", dirty: true });
    expect(discardSupervisionWorkspaceDraft(requested)).toEqual({
      active: "quality",
      pending: null,
      dirty: false,
    });
  });
});
